import { describe, expect, it } from "vitest";

import { deriveEntitlementId, receiptHash } from "../src/hashing";
import { ReceiptSchema } from "../src/schemas";

import receiptFixture from "../fixtures/receipt.fixture.json";
import golden from "../fixtures/golden.fixture.json";

describe("golden hashing", () => {
  it("derives entitlement id deterministically", () => {
    const d = deriveEntitlementId({
      merchant_id: "demo-merchant",
      buyer: "0x000000000000000000000000000000000000dEaD",
      product_id: "article:42",
    });

    expect(d.merchant_id_hash).toBe(golden.merchant_id_hash);
    expect(d.product_id_hash).toBe(golden.product_id_hash);
    expect(d.entitlement_id).toBe(golden.entitlement_id);
  });

  it("hashes receipt via canonical stable json", () => {
    const parsed = ReceiptSchema.parse(receiptFixture);
    const h = receiptHash(parsed);
    expect(h).toBe(golden.receipt_hash);
  });
});
