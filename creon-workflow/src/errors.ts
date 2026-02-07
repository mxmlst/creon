export class PurchaseError extends Error {
  readonly code:
    | "INVALID_INPUT"
    | "MISSING_PAYMENT_PROOF"
    | "REPLAY_DETECTED"
    | "IDEMPOTENCY_CONFLICT"
    | "CHAIN_ERROR";

  constructor(
    code:
      | "INVALID_INPUT"
      | "MISSING_PAYMENT_PROOF"
      | "REPLAY_DETECTED"
      | "IDEMPOTENCY_CONFLICT"
      | "CHAIN_ERROR",
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

export class ReunlockError extends Error {
  readonly code:
    | "INVALID_INPUT"
    | "NO_ENTITLEMENT"
    | "ENTITLEMENT_EXPIRED"
    | "ENTITLEMENT_REVOKED"
    | "USES_EXCEEDED"
    | "CHAIN_ERROR";

  constructor(
    code:
      | "INVALID_INPUT"
      | "NO_ENTITLEMENT"
      | "ENTITLEMENT_EXPIRED"
      | "ENTITLEMENT_REVOKED"
      | "USES_EXCEEDED"
      | "CHAIN_ERROR",
    message: string
  ) {
    super(message);
    this.code = code;
  }
}
