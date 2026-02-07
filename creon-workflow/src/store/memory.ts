import type { IdempotencyStore, ReplayStore, StoredPurchaseOutcome } from "./types";

export class MemoryStore implements IdempotencyStore, ReplayStore {
  private outcomes = new Map<
    string,
    { request_hash: `0x${string}`; outcome: StoredPurchaseOutcome }
  >();
  private paymentRefs = new Map<string, `0x${string}`>();

  async getOutcome(params: { merchant_id: string; idempotency_key: string }) {
    const key = `${params.merchant_id}::${params.idempotency_key}`;
    return this.outcomes.get(key) ?? null;
  }

  async setOutcome(params: {
    merchant_id: string;
    idempotency_key: string;
    request_hash: `0x${string}`;
    outcome: StoredPurchaseOutcome;
  }) {
    const key = `${params.merchant_id}::${params.idempotency_key}`;
    this.outcomes.set(key, { request_hash: params.request_hash, outcome: params.outcome });
  }

  async getPaymentRef(payment_ref: string) {
    const id = this.paymentRefs.get(payment_ref);
    if (!id) return null;
    return { entitlement_id: id };
  }

  async setPaymentRef(params: { payment_ref: string; entitlement_id: `0x${string}` }) {
    this.paymentRefs.set(params.payment_ref, params.entitlement_id);
  }
}
