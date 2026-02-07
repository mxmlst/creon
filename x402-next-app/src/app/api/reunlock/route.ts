import { NextResponse } from "next/server";

import { runWorkflow } from "@/lib/cre";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const intent = body.intent ?? body;

    const payload = {
      action: "reunlock",
      intent: {
        merchant_id: intent.merchant_id,
        buyer: intent.buyer,
        product_id: intent.product_id,
      },
    };

    const disableBroadcastRaw = (process.env.DISABLE_BROADCAST ?? "").toLowerCase();
    const broadcast = !["1", "true", "yes"].includes(disableBroadcastRaw);
    const hasPrivateKey = Boolean(process.env.CRE_ETH_PRIVATE_KEY);

    const result = await runWorkflow(payload, { broadcast });

    const response = NextResponse.json(result, { status: result.ok ? 200 : 500 });
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
        error: { code: "REUNLOCK_ROUTE_ERROR", message: String(err) },
      },
      { status: 500 }
    );
  }
}
