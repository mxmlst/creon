import { NextResponse } from "next/server";

import { runWorkflow } from "@/lib/cre";
import { products } from "@/lib/products";
import {
  buildPaymentRequired,
  decodeHeader,
  encodeHeader,
  isValidSignature,
  type X402PaymentSignature,
} from "@/lib/x402";

export const runtime = "nodejs";

const getSignatureHeader = (req: Request) =>
  req.headers.get("payment-signature") ??
  req.headers.get("x-payment-signature") ??
  req.headers.get("payment-authorization");

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

  const required = buildPaymentRequired({
    resource: new URL(req.url).pathname,
    amount: String(Math.round(product.priceUsd * 100)),
    memo: product.title,
  });

    const signatureRaw = getSignatureHeader(req);
    if (!signatureRaw) {
      const response = NextResponse.json(
        { ok: false, error: required.error, required },
        { status: 402 }
      );
      response.headers.set("payment-required", encodeHeader(required));
      response.headers.set("cache-control", "no-store");
      return response;
    }

    let signature: X402PaymentSignature;
    try {
      signature = decodeHeader<X402PaymentSignature>(signatureRaw);
    } catch {
      const response = NextResponse.json(
        { ok: false, error: "invalid payment signature", required },
        { status: 402 }
      );
      response.headers.set("payment-required", encodeHeader(required));
      response.headers.set("cache-control", "no-store");
      return response;
    }

    if (!isValidSignature(signature, required.accepts[0])) {
      const response = NextResponse.json(
        { ok: false, error: "payment verification failed", required },
        { status: 402 }
      );
      response.headers.set("payment-required", encodeHeader(required));
      response.headers.set("cache-control", "no-store");
      return response;
    }

    const payment_ref = signature.payment_ref ?? intent.payment_ref;
    if (!payment_ref) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_PAYMENT_REF", message: "payment_ref required" } },
        { status: 400 }
      );
    }

    const payload = {
      action: "purchase",
      intent: {
        merchant_id: intent.merchant_id,
        buyer: intent.buyer,
        product_id: intent.product_id,
        amount: intent.amount ?? product.priceUsd.toFixed(2),
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

    const result = await runWorkflow(payload, { broadcast });

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
