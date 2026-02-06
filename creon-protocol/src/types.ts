export type Hex = `0x${string}`;

export type PurchaseIntent = {
  merchant_id: string;
  buyer: Hex;
  product_id: string;
  amount: string;
  currency: string;
  payment_ref: string;
  idempotency_key: string;
};

export type PaymentProof = {
  kind: "x402";
  receipt: unknown;
};

export type AccessIntent = {
  merchant_id: string;
  buyer: Hex;
  product_id: string;
};

export type Policy = {
  version: string;
};

export type Receipt = {
  version: string;
  merchant_id: string;
  buyer: Hex;
  product_id: string;
  payment_ref: string;
  entitlement_id: Hex;
  tx_hash: Hex;
  workflow_version: string;
  policy_version: string;
  issued_at: string;
};

export type AccountingLine = {
  account: string;
  debit: string;
  credit: string;
  memo?: string;
};

export type AccountingPacket = {
  version: string;
  receipt_hash: Hex;
  lines: AccountingLine[];
};

export type AuditEvent = {
  at: string;
  type: string;
  data: Record<string, unknown>;
};

export type UnlockGrant =
  | { kind: "content_token"; token: string; expires_at?: string }
  | { kind: "signed_url"; url: string; expires_at?: string }
  | { kind: "session_token"; token: string; expires_at?: string }
  | { kind: "stream_grant"; token: string; expires_at?: string };

export type EntitlementDerivation = {
  merchant_id_hash: Hex;
  product_id_hash: Hex;
  entitlement_id: Hex;
};
