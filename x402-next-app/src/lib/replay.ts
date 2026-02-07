import { createHash } from "node:crypto";

const replayMap = new Map<string, string>();

export const fingerprintIntent = (intent: Record<string, unknown>) => {
  const json = JSON.stringify(intent);
  return createHash("sha256").update(json).digest("hex");
};

export const checkAndMarkReplay = (paymentRef: string, fingerprint: string) => {
  const existing = replayMap.get(paymentRef);
  if (!existing) {
    replayMap.set(paymentRef, fingerprint);
    return { ok: true };
  }
  if (existing !== fingerprint) {
    return { ok: false, reason: "REPLAY_DETECTED" };
  }
  return { ok: true };
};
