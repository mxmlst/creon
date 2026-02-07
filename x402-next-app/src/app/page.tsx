"use client";

import { useMemo, useState } from "react";

import { products } from "@/lib/products";
import {
  buildPaymentRequired,
  buildPaymentSignature,
  decodeHeader,
  encodeHeader,
  type X402PaymentRequired,
} from "@/lib/x402";

type PurchaseResult = {
  ok: boolean;
  outcome?: {
    minted: boolean;
    tx_hash: string;
    entitlement_id: string;
    artifacts: {
      receipt_json: string;
      receipt_hash: string;
      accounting_packet_json: string;
      accounting_packet_csv: string;
      audit_bundle_jsonl: string;
    };
  };
  error?: { code: string; message: string };
};

type ReunlockResult = {
  ok: boolean;
  grant?: { kind: string; token: string; expires_at: string };
  tx_hash?: string;
  error?: { code: string; message: string };
};

const defaultBuyer = "0x000000000000000000000000000000000000dEaD";

const makePaymentRef = () => `x402:receipt:${Math.random().toString(36).slice(2, 10)}`;

const downloadText = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

export default function HomePage() {
  const [productId, setProductId] = useState(products[0].id);
  const [merchantId, setMerchantId] = useState("demo-merchant");
  const [buyer, setBuyer] = useState(defaultBuyer);
  const [paymentRef, setPaymentRef] = useState(makePaymentRef());
  const [paymentRequired, setPaymentRequired] = useState<X402PaymentRequired | null>(null);
  const [paymentSignature, setPaymentSignature] = useState<string | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);
  const [reunlockResult, setReunlockResult] = useState<ReunlockResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const product = useMemo(
    () => products.find((item) => item.id === productId) ?? products[0],
    [productId]
  );

  const intent = useMemo(
    () => ({
      merchant_id: merchantId,
      buyer,
      product_id: product.id,
      amount: product.priceUsd.toFixed(2),
      currency: "USD",
      payment_ref: paymentRef,
      idempotency_key: "idemp-1",
    }),
    [merchantId, buyer, product, paymentRef]
  );

  const purchasePayload = useMemo(
    () => ({
      action: "purchase",
      intent,
      payment_proof: {
        kind: "x402",
        receipt: { id: paymentRef },
      },
    }),
    [intent, paymentRef]
  );

  const reunlockPayload = useMemo(
    () => ({
      action: "reunlock",
      intent: {
        merchant_id: merchantId,
        buyer,
        product_id: product.id,
      },
    }),
    [merchantId, buyer, product]
  );

  const safeJson = async <T,>(response: Response): Promise<T> => {
    const text = await response.text();
    if (!text) {
      throw new Error("Empty response body");
    }
    return JSON.parse(text) as T;
  };

  const handlePurchase = async () => {
    setStatus("Requesting purchase...");
    setPurchaseResult(null);
    setPaymentRequired(null);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (paymentSignature) {
      headers["payment-signature"] = paymentSignature;
    }

    const response = await fetch("/api/purchase", {
      method: "POST",
      headers,
      body: JSON.stringify(purchasePayload),
    });

    if (response.status === 402) {
      const required = response.headers.get("payment-required");
      if (required) {
        setPaymentRequired(decodeHeader<X402PaymentRequired>(required));
      }
      setDebugInfo(response.headers.get("x-cre-debug"));
      setStatus("Payment required. Generate signature to continue.");
      return;
    }

    setDebugInfo(response.headers.get("x-cre-debug"));
    const data = await safeJson<PurchaseResult>(response);
    setPurchaseResult(data);
    setStatus(data.ok ? "Purchase complete." : "Purchase failed.");
  };

  const handleGenerateSignature = () => {
    const required =
      paymentRequired?.accepts?.[0] ??
      buildPaymentRequired({
        resource: "/api/purchase",
        amount: String(Math.round(product.priceUsd * 100)),
        memo: product.title,
      }).accepts[0];

    const signature = buildPaymentSignature({
      amount: required.amount,
      payer: buyer,
      payment_ref: paymentRef,
      memo: product.title,
    });

    setPaymentSignature(encodeHeader(signature));
    setStatus("Payment signature generated. Retry purchase.");
  };

  const handleReunlock = async () => {
    setStatus("Requesting re-unlock...");
    setReunlockResult(null);

    const response = await fetch("/api/reunlock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reunlockPayload),
    });

    setDebugInfo(response.headers.get("x-cre-debug"));
    const data = await safeJson<ReunlockResult>(response);
    setReunlockResult(data);
    setStatus(data.ok ? "Re-unlock complete." : "Re-unlock denied.");
  };

  return (
    <main className="min-h-screen grid-hero">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-10">
          <header className="flex flex-col gap-4">
            <div className="chip">CRE + x402</div>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
              Creon x402 Demo Store
            </h1>
            <p className="text-lg text-sand/80 max-w-2xl">
              Pay once, re-unlock later. This shop exercises the CRE purchase workflow, mints
              onchain entitlements, and returns deterministic artifacts for audit and accounting.
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
            <div className="glass rounded-3xl p-6 shadow-glow">
              <h2 className="text-xl font-semibold">Catalog</h2>
              <p className="text-sand/70 text-sm mt-1">
                Select a product, then run purchase + re-unlock.
              </p>

              <div className="mt-6 grid gap-4">
                {products.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setProductId(item.id)}
                    className={`text-left rounded-2xl border px-4 py-3 transition ${
                      item.id === productId
                        ? "border-ember bg-ember/10"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <div className="flex justify-between">
                      <div>
                        <div className="text-base font-semibold">{item.title}</div>
                        <div className="text-xs uppercase tracking-[0.18em] text-sand/60">
                          {item.kind}
                        </div>
                      </div>
                      <div className="text-lg font-semibold">${item.priceUsd}</div>
                    </div>
                    <p className="text-sm text-sand/70 mt-2">{item.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="glass rounded-3xl p-6 shadow-glow">
              <h2 className="text-xl font-semibold">Purchase Request</h2>
              <p className="text-sand/70 text-sm mt-1">
                Manual x402 flow: request, receive 402, attach payment signature, retry.
              </p>

              <div className="mt-5 grid gap-3 text-sm">
                <label className="grid gap-1">
                  Merchant ID
                  <input
                    className="rounded-lg bg-stone border border-white/10 px-3 py-2"
                    value={merchantId}
                    onChange={(event) => setMerchantId(event.target.value)}
                  />
                </label>
                <label className="grid gap-1">
                  Buyer Address
                  <input
                    className="rounded-lg bg-stone border border-white/10 px-3 py-2 font-mono text-xs"
                    value={buyer}
                    onChange={(event) => setBuyer(event.target.value)}
                  />
                </label>
                <label className="grid gap-1">
                  Payment Ref
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg bg-stone border border-white/10 px-3 py-2 font-mono text-xs"
                      value={paymentRef}
                      onChange={(event) => setPaymentRef(event.target.value)}
                    />
                    <button
                      className="rounded-lg border border-white/20 px-3 py-2 text-xs"
                      onClick={() => setPaymentRef(makePaymentRef())}
                    >
                      New
                    </button>
                  </div>
                </label>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  className="rounded-full bg-ember px-5 py-2 text-sm font-semibold text-night"
                  onClick={handlePurchase}
                >
                  Purchase
                </button>
                <button
                  className="rounded-full border border-white/20 px-5 py-2 text-sm"
                  onClick={handleGenerateSignature}
                >
                  Generate Payment Signature
                </button>
                <button
                  className="rounded-full border border-white/20 px-5 py-2 text-sm"
                  onClick={handleReunlock}
                >
                  Re-unlock
                </button>
              </div>

              {status && <p className="mt-4 text-sm text-frost">{status}</p>}
              {debugInfo && (
                <p className="mt-2 text-xs text-sand/60 font-mono break-all">
                  debug: {debugInfo}
                </p>
              )}

              {paymentRequired && (
                <div className="mt-5 rounded-2xl border border-ember/40 bg-ember/10 p-4 text-sm">
                  <div className="font-semibold">Payment Required</div>
                  <div className="text-sand/80">
                    Amount: {paymentRequired.accepts[0]?.amount} · Asset:{" "}
                    {paymentRequired.accepts[0]?.asset}
                  </div>
                  <div className="text-sand/60 text-xs mt-2">
                    Pay to {paymentRequired.accepts[0]?.payTo} on{" "}
                    {paymentRequired.accepts[0]?.network}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
            <div className="glass rounded-3xl p-6 shadow-glow">
              <h3 className="text-lg font-semibold">Purchase Result</h3>
              {!purchaseResult && (
                <p className="text-sm text-sand/70 mt-2">No purchase run yet.</p>
              )}
              {purchaseResult && (
                <div className="mt-4 space-y-3 text-sm">
                  <div>Status: {purchaseResult.ok ? "ok" : "error"}</div>
                  <div>Minted: {purchaseResult.outcome?.minted ? "yes" : "no"}</div>
                  {!purchaseResult.outcome?.minted && (
                    <div className="text-xs text-sand/70">
                      No mint means broadcast disabled or entitlement already exists.
                    </div>
                  )}
                  <div className="font-mono text-xs break-all">
                    tx_hash: {purchaseResult.outcome?.tx_hash}
                  </div>
                  <div className="font-mono text-xs break-all">
                    entitlement_id: {purchaseResult.outcome?.entitlement_id}
                  </div>
                  {purchaseResult.outcome?.artifacts && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-white/20 px-4 py-1.5 text-xs"
                        onClick={() =>
                          downloadText(
                            "receipt.json",
                            purchaseResult.outcome?.artifacts.receipt_json ?? ""
                          )
                        }
                      >
                        Download Receipt
                      </button>
                      <button
                        className="rounded-full border border-white/20 px-4 py-1.5 text-xs"
                        onClick={() =>
                          downloadText(
                            "accounting.json",
                            purchaseResult.outcome?.artifacts.accounting_packet_json ?? ""
                          )
                        }
                      >
                        Download Accounting JSON
                      </button>
                      <button
                        className="rounded-full border border-white/20 px-4 py-1.5 text-xs"
                        onClick={() =>
                          downloadText(
                            "accounting.csv",
                            purchaseResult.outcome?.artifacts.accounting_packet_csv ?? ""
                          )
                        }
                      >
                        Download Accounting CSV
                      </button>
                      <button
                        className="rounded-full border border-white/20 px-4 py-1.5 text-xs"
                        onClick={() =>
                          downloadText(
                            "audit.jsonl",
                            purchaseResult.outcome?.artifacts.audit_bundle_jsonl ?? ""
                          )
                        }
                      >
                        Download Audit Bundle
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="glass rounded-3xl p-6 shadow-glow">
              <h3 className="text-lg font-semibold">Re-unlock Result</h3>
              {!reunlockResult && (
                <p className="text-sm text-sand/70 mt-2">No re-unlock run yet.</p>
              )}
              {reunlockResult && (
                <div className="mt-4 space-y-3 text-sm">
                  <div>Status: {reunlockResult.ok ? "ok" : "error"}</div>
                  {reunlockResult.grant && (
                    <>
                      <div>Kind: {reunlockResult.grant.kind}</div>
                      <div className="font-mono text-xs break-all">
                        token: {reunlockResult.grant.token}
                      </div>
                      <div>expires_at: {reunlockResult.grant.expires_at}</div>
                    </>
                  )}
                  {reunlockResult.error && (
                    <div className="text-ember">
                      {reunlockResult.error.code}: {reunlockResult.error.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
