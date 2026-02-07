import { describe, expect, it } from "vitest";

import { requireMinimumAmount, requirePaymentRefFormat } from "./guards";

describe("requireMinimumAmount", () => {
  it("accepts exact amount", () => {
    expect(requireMinimumAmount("10.00", 10)).toEqual({ ok: true });
  });

  it("rejects underpayment", () => {
    expect(requireMinimumAmount("9.99", 10)).toEqual({ ok: false, error: "UNDERPAYMENT" });
  });

  it("rejects invalid amount", () => {
    expect(requireMinimumAmount("not-a-number", 10)).toEqual({
      ok: false,
      error: "INVALID_AMOUNT",
    });
  });
});

describe("requirePaymentRefFormat", () => {
  it("accepts x402 receipt format", () => {
    expect(requirePaymentRefFormat("x402:receipt:abc123")).toEqual({ ok: true });
  });

  it("rejects malformed receipt", () => {
    expect(requirePaymentRefFormat("bad-receipt")).toEqual({
      ok: false,
      error: "INVALID_RECEIPT",
    });
  });
});
