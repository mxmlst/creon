import { describe, expect, it } from "vitest";

import { checkAndMarkReplay, fingerprintIntent } from "./replay";

describe("checkAndMarkReplay", () => {
  it("accepts first use", () => {
    const fingerprint = fingerprintIntent({ product_id: "article:42", buyer: "0x1" });
    expect(checkAndMarkReplay("ref-1", fingerprint)).toEqual({ ok: true });
  });

  it("rejects replay with different intent", () => {
    const a = fingerprintIntent({ product_id: "article:42", buyer: "0x1" });
    const b = fingerprintIntent({ product_id: "article:43", buyer: "0x1" });
    checkAndMarkReplay("ref-2", a);
    expect(checkAndMarkReplay("ref-2", b)).toEqual({ ok: false, reason: "REPLAY_DETECTED" });
  });
});
