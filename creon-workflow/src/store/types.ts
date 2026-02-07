export type StoredPurchaseOutcome = {
  minted: boolean;
  tx_hash: `0x${string}`;
  entitlement_id: `0x${string}`;
  artifacts: {
    receipt_json: string;
    receipt_hash: `0x${string}`;
    accounting_packet_json: string;
    accounting_packet_csv: string;
    audit_bundle_jsonl: string;
  };
};

export type IdempotencyStore = {
  getOutcome(params: { merchant_id: string; idempotency_key: string }): Promise<{
    request_hash: `0x${string}`;
    outcome: StoredPurchaseOutcome;
  } | null>;
  setOutcome(params: {
    merchant_id: string;
    idempotency_key: string;
    request_hash: `0x${string}`;
    outcome: StoredPurchaseOutcome;
  }): Promise<void>;
};

export type ReplayStore = {
  getPaymentRef(payment_ref: string): Promise<{ entitlement_id: `0x${string}` } | null>;
  setPaymentRef(params: { payment_ref: string; entitlement_id: `0x${string}` }): Promise<void>;
};
