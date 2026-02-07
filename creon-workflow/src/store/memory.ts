import type { IdempotencyStore, ReplayStore, StoredPurchaseOutcome } from "./types";

export class MemoryStore implements IdempotencyStore, ReplayStore {
  private idempotency = new Map<string, { request_hash: `0x${string}`; outcome: StoredPurchaseOutcome }>();
  private replay = new Map<string, { entitlement_id: `0x${string}` }>();

  async getOutcome(params: { merchant_id: string; idempotency_key: string }) {
    const key = `${params.merchant_id}:${params.idempotency_key}`;
    return this.idempotency.get(key) ?? null;
  }

  async setOutcome(params: {
    merchant_id: string;
    idempotency_key: string;
    request_hash: `0x${string}`;
    outcome: StoredPurchaseOutcome;
  }) {
    const key = `${params.merchant_id}:${params.idempotency_key}`;
    this.idempotency.set(key, { request_hash: params.request_hash, outcome: params.outcome });
  }

  async getPaymentRef(payment_ref: string) {
    return this.replay.get(payment_ref) ?? null;
  }

  async setPaymentRef(params: { payment_ref: string; entitlement_id: `0x${string}` }) {
    this.replay.set(params.payment_ref, { entitlement_id: params.entitlement_id });
  }
}
