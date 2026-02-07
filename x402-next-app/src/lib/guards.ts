export const requireMinimumAmount = (amount: string, minimum: number) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return { ok: false, error: "INVALID_AMOUNT" };
  }
  if (value + 1e-9 < minimum) {
    return { ok: false, error: "UNDERPAYMENT" };
  }
  return { ok: true };
};

export const requirePaymentRefFormat = (paymentRef: string) => {
  if (!paymentRef || !paymentRef.startsWith("x402:receipt:")) {
    return { ok: false, error: "INVALID_RECEIPT" };
  }
  return { ok: true };
};
