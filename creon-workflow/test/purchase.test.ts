import { expect, it } from "vitest";

import { MemoryStore } from "../src/store/memory";
import { processPurchase } from "../src/purchase";

const baseIntent = {
  merchant_id: "demo-merchant",
  buyer: "0x000000000000000000000000000000000000dEaD",
  product_id: "article:42",
  amount: "10.00",
  currency: "USD",
  payment_ref: "x402:receipt:abc123",
  idempotency_key: "idemp-1",
};

const config = { workflow_version: "0.0.0", policy_version: "0.0.0" };

const payment_proof = { kind: "x402", receipt: { id: "abc123" } };

it("returns identical outcome for idempotent retries", async () => {
  const store = new MemoryStore();
  let writes = 0;
  const evm = {
    readEntitlement: async () => ({ active: false }),
    writeGrant: async () => {
      writes += 1;
      return { tx_hash: ("0x" + "11".repeat(32)) as `0x${string}` };
    },
  };

  const first = await processPurchase({
    input: { intent: baseIntent, payment_proof },
    stores: { idempotency: store, replay: store },
    evm,
    config,
    issued_at: "2026-02-07T00:00:00.000Z",
  });

  const second = await processPurchase({
    input: { intent: baseIntent, payment_proof },
    stores: { idempotency: store, replay: store },
    evm,
    config,
    issued_at: "2026-02-07T00:00:01.000Z",
  });

  expect(second).toEqual(first);
  expect(writes).toBe(1);
});

it("rejects reused payment_ref", async () => {
  const store = new MemoryStore();
  const evm = {
    readEntitlement: async () => ({ active: false }),
    writeGrant: async () => ({ tx_hash: ("0x" + "22".repeat(32)) as `0x${string}` }),
  };

  await processPurchase({
    input: { intent: baseIntent, payment_proof },
    stores: { idempotency: store, replay: store },
    evm,
    config,
    issued_at: "2026-02-07T00:00:00.000Z",
  });

  const otherIntent = { ...baseIntent, idempotency_key: "idemp-2" };
  await expect(
    processPurchase({
      input: { intent: otherIntent, payment_proof },
      stores: { idempotency: store, replay: store },
      evm,
      config,
      issued_at: "2026-02-07T00:00:01.000Z",
    })
  ).rejects.toThrow("payment_ref has already been used");
});

it("returns deterministic receipt when entitlement already exists", async () => {
  const store = new MemoryStore();
  let writes = 0;
  const evm = {
    readEntitlement: async () => ({ active: true }),
    writeGrant: async () => {
      writes += 1;
      return { tx_hash: ("0x" + "33".repeat(32)) as `0x${string}` };
    },
  };

  const result = await processPurchase({
    input: { intent: baseIntent, payment_proof },
    stores: { idempotency: store, replay: store },
    evm,
    config,
    issued_at: "2026-02-07T00:00:00.000Z",
  });

  expect(result.minted).toBe(false);
  expect(result.tx_hash).toBe("0x" + "00".repeat(32));
  expect(writes).toBe(0);
});
