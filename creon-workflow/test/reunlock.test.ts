import { describe, expect, it } from "vitest";

import { processReunlock } from "../src/reunlock";

const baseIntent = {
  merchant_id: "demo-merchant",
  buyer: "0x000000000000000000000000000000000000dEaD",
  product_id: "article:42",
};

const config = { default_grant_ttl_seconds: 3600 };

describe("re-unlock", () => {
  it("denies when no entitlement", async () => {
    const evm = {
      readEntitlement: async () => ({
        active: false,
        valid_from: 0,
        valid_until: 0,
        max_uses: 0,
        uses: 0,
      }),
      consumeEntitlement: async () => ({ tx_hash: ("0x" + "11".repeat(32)) as `0x${string}` }),
    };

    await expect(
      processReunlock({
        input: { intent: baseIntent },
        evm,
        config,
        issued_at: "2026-02-07T00:00:00.000Z",
      })
    ).rejects.toThrow("entitlement not found or inactive");
  });

  it("denies when expired", async () => {
    const evm = {
      readEntitlement: async () => ({
        active: true,
        valid_from: 0,
        valid_until: 1,
        max_uses: 0,
        uses: 0,
      }),
      consumeEntitlement: async () => ({ tx_hash: ("0x" + "11".repeat(32)) as `0x${string}` }),
    };

    await expect(
      processReunlock({
        input: { intent: baseIntent },
        evm,
        config,
        issued_at: "2026-02-07T00:00:10.000Z",
      })
    ).rejects.toThrow("entitlement expired");
  });

  it("allows active entitlement", async () => {
    let consumeCalls = 0;
    const evm = {
      readEntitlement: async () => ({
        active: true,
        valid_from: 0,
        valid_until: 0,
        max_uses: 0,
        uses: 0,
      }),
      consumeEntitlement: async () => {
        consumeCalls += 1;
        return { tx_hash: ("0x" + "22".repeat(32)) as `0x${string}` };
      },
    };

    const result = await processReunlock({
      input: { intent: baseIntent },
      evm,
      config,
      issued_at: "2026-02-07T00:00:00.000Z",
    });

    expect(result.grant.kind).toBe("content_token");
    expect(consumeCalls).toBe(0);
  });

  it("consumes when usage limited", async () => {
    let consumeCalls = 0;
    const evm = {
      readEntitlement: async () => ({
        active: true,
        valid_from: 0,
        valid_until: 0,
        max_uses: 2,
        uses: 1,
      }),
      consumeEntitlement: async () => {
        consumeCalls += 1;
        return { tx_hash: ("0x" + "33".repeat(32)) as `0x${string}` };
      },
    };

    const result = await processReunlock({
      input: { intent: baseIntent },
      evm,
      config,
      issued_at: "2026-02-07T00:00:00.000Z",
    });

    expect(result.tx_hash).toBe("0x" + "33".repeat(32));
    expect(consumeCalls).toBe(1);
  });
});
