import { NextResponse } from "next/server";

import { createThirdwebClient, defineChain } from "thirdweb";
import { facilitator, settlePayment } from "thirdweb/x402";

import { runWorkflow, type WorkflowResult } from "@/lib/cre";
import { requireMinimumAmount, requirePaymentRefFormat } from "@/lib/guards";
import { products } from "@/lib/products";
import { checkAndMarkReplay, fingerprintIntent } from "@/lib/replay";
import { encodeHeader } from "@/lib/x402";

export const runtime = "nodejs";

const getPaymentHeader = (req: Request) =>
  req.headers.get("payment-signature") ??
  req.headers.get("x-payment") ??
  req.headers.get("x-payment-signature") ??
  req.headers.get("payment-authorization");

const parseChainId = () => {
  const raw = process.env.X402_CHAIN_ID ?? process.env.X402_NETWORK ?? "11155111";
  const match = raw.match(/\d+/g);
  if (!match || match.length === 0) return 11155111;
  return Number(match[match.length - 1]);
};

const applyHeaders = (response: NextResponse, headers?: Record<string, string>) => {
  if (!headers) return;
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const intent = body.intent ?? body;

    const product = products.find((item) => item.id === intent.product_id);
    if (!product) {
      return NextResponse.json(
        { ok: false, error: { code: "UNKNOWN_PRODUCT", message: "unknown product_id" } },
        { status: 400 }
      );
    }

    const amount = String(intent.amount ?? product.priceUsd.toFixed(2));
    const minCheck = requireMinimumAmount(amount, product.priceUsd);
    if (!minCheck.ok) {
      return NextResponse.json(
        { ok: false, error: { code: minCheck.error, message: "underpayment" } },
        { status: 400 }
      );
    }

    const payment_ref = intent.payment_ref;
    if (!payment_ref) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_PAYMENT_REF", message: "payment_ref required" } },
        { status: 400 }
      );
    }

    const refCheck = requirePaymentRefFormat(payment_ref);
    if (!refCheck.ok) {
      return NextResponse.json(
        { ok: false, error: { code: refCheck.error, message: "invalid receipt format" } },
        { status: 400 }
      );
    }

    const replayCheck = checkAndMarkReplay(
      payment_ref,
      fingerprintIntent({
        merchant_id: intent.merchant_id,
        buyer: intent.buyer,
        product_id: intent.product_id,
        amount,
        currency: intent.currency ?? "USD",
      })
    );
    if (!replayCheck.ok) {
      return NextResponse.json(
        { ok: false, error: { code: replayCheck.reason, message: "payment_ref reused" } },
        { status: 409 }
      );
    }

    const paymentData = getPaymentHeader(req);
    const secretKey = process.env.THIRDWEB_SECRET_KEY;
    const payTo = process.env.X402_PAY_TO;

    if (!secretKey || !payTo) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "X402_CONFIG",
            message: "THIRDWEB_SECRET_KEY and X402_PAY_TO are required",
          },
        },
        { status: 500 }
      );
    }

    const chainId = parseChainId();
    const chain = defineChain(chainId);
    const client = createThirdwebClient({ secretKey });
    const x402Facilitator = facilitator({ client, serverWalletAddress: payTo });

    const settlement = (await settlePayment({
      paymentData,
      resourceUrl: new URL(req.url).toString(),
      method: "POST",
      payTo,
      price: `$${product.priceUsd.toFixed(2)}`,
      network: chain,
      scheme: "exact",
      x402Version: 2,
      facilitator: x402Facilitator,
    })) as {
      status: number;
      responseBody: unknown;
      responseHeaders?: Record<string, string>;
    };

    if (settlement.status !== 200) {
      const body = settlement.responseBody ?? {};
      if (typeof body === "string") {
        const response = new NextResponse(body, { status: settlement.status });
        applyHeaders(response as NextResponse, settlement.responseHeaders);
        response.headers.set("cache-control", "no-store");
        return response;
      }
      const response = NextResponse.json(body, { status: settlement.status });
      applyHeaders(response, settlement.responseHeaders);
      response.headers.set("cache-control", "no-store");
      return response;
    }

    const payload = {
      action: "purchase",
      intent: {
        merchant_id: intent.merchant_id,
        buyer: intent.buyer,
        product_id: intent.product_id,
        amount,
        currency: intent.currency ?? "USD",
        payment_ref,
        idempotency_key: intent.idempotency_key ?? "idemp-1",
      },
      payment_proof: {
        kind: "x402",
        receipt: { id: payment_ref },
      },
    };

    const disableBroadcastRaw = (process.env.DISABLE_BROADCAST ?? "").toLowerCase();
    const broadcast = !["1", "true", "yes"].includes(disableBroadcastRaw);
    const hasPrivateKey = Boolean(process.env.CRE_ETH_PRIVATE_KEY);

    const result = (await runWorkflow(payload, { broadcast })) as WorkflowResult;

    const response = NextResponse.json(result, { status: result.ok ? 200 : 500 });
    response.headers.set(
      "payment-response",
      encodeHeader({
        status: result.ok ? "accepted" : "failed",
        payment_ref,
        tx_hash: result.outcome?.tx_hash ?? result.tx_hash ?? "",
      })
    );
    response.headers.set("cache-control", "no-store");
    if (process.env.X402_DEBUG === "1") {
      response.headers.set(
        "x-cre-debug",
        JSON.stringify({ broadcast, hasPrivateKey })
      );
    }
    return response;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "PURCHASE_ROUTE_ERROR", message: String(err) },
      },
      { status: 500 }
    );
  }
}
