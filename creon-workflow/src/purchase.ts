import {
  deriveEntitlementId,
  PaymentProofSchema,
  PurchaseIntentSchema,
  stableStringify,
  type StableJson,
} from "@creon/protocol";
import { keccak256, toHex } from "viem";

import { buildArtifacts } from "./artifacts";
import { PurchaseError } from "./errors";
import type { IdempotencyStore, ReplayStore, StoredPurchaseOutcome } from "./store/types";

export type PurchaseInput = {
  intent: unknown;
  payment_proof: unknown;
};

export type PurchaseConfig = {
  workflow_version: string;
  policy_version: string;
};

export type PurchaseEvm = {
  readEntitlement: (params: {
    merchant_id_hash: `0x${string}`;
    buyer: `0x${string}`;
    product_id_hash: `0x${string}`;
  }) => Promise<{ active: boolean }>;
  writeGrant: (params: {
    merchant_id_hash: `0x${string}`;
    buyer: `0x${string}`;
    product_id_hash: `0x${string}`;
    valid_until: number;
    max_uses: number;
    metadata_hash: `0x${string}`;
  }) => Promise<{ tx_hash: `0x${string}` }>;
};

export const requestHash = (intent: unknown) =>
  keccak256(toHex(stableStringify(intent as unknown as StableJson))) as `0x${string}`;

export const processPurchase = async (params: {
  input: PurchaseInput;
  stores: { idempotency: IdempotencyStore; replay: ReplayStore };
  evm: PurchaseEvm;
  config: PurchaseConfig;
  issued_at: string;
}): Promise<StoredPurchaseOutcome> => {
  const intent = PurchaseIntentSchema.parse(params.input.intent);
  const paymentProof = PaymentProofSchema.safeParse(params.input.payment_proof);

  if (!paymentProof.success) {
    throw new PurchaseError("MISSING_PAYMENT_PROOF", "payment_proof is required");
  }

  const reqHash = requestHash(intent);
  const existing = await params.stores.idempotency.getOutcome({
    merchant_id: intent.merchant_id,
    idempotency_key: intent.idempotency_key,
  });

  if (existing) {
    if (existing.request_hash !== reqHash) {
      throw new PurchaseError(
        "IDEMPOTENCY_CONFLICT",
        "idempotency key already used with different input"
      );
    }
    return existing.outcome;
  }

  const replay = await params.stores.replay.getPaymentRef(intent.payment_ref);
  if (replay) {
    throw new PurchaseError("REPLAY_DETECTED", "payment_ref has already been used");
  }

  const derivation = deriveEntitlementId({
    merchant_id: intent.merchant_id,
    buyer: intent.buyer,
    product_id: intent.product_id,
  });

  const entitlement = await params.evm.readEntitlement({
    merchant_id_hash: derivation.merchant_id_hash,
    buyer: intent.buyer,
    product_id_hash: derivation.product_id_hash,
  });

  let minted = false;
  let tx_hash: `0x${string}` = "0x0000000000000000000000000000000000000000000000000000000000000000";

  if (!entitlement.active) {
    const write = await params.evm.writeGrant({
      merchant_id_hash: derivation.merchant_id_hash,
      buyer: intent.buyer,
      product_id_hash: derivation.product_id_hash,
      valid_until: 0,
      max_uses: 0,
      metadata_hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    });
    minted = true;
    tx_hash = write.tx_hash;
  }

  const receipt = {
    version: "1",
    merchant_id: intent.merchant_id,
    buyer: intent.buyer,
    product_id: intent.product_id,
    payment_ref: intent.payment_ref,
    entitlement_id: derivation.entitlement_id,
    tx_hash,
    workflow_version: params.config.workflow_version,
    policy_version: params.config.policy_version,
    issued_at: params.issued_at,
  };

  const artifacts = buildArtifacts({
    receipt,
    entitlement_id: derivation.entitlement_id,
    tx_hash,
    minted,
    amount: intent.amount,
  });

  const outcome: StoredPurchaseOutcome = {
    minted,
    tx_hash,
    entitlement_id: derivation.entitlement_id,
    artifacts: {
      receipt_json: JSON.stringify(artifacts.receipt, null, 2),
      receipt_hash: artifacts.receipt_hash,
      accounting_packet_json: artifacts.accounting_packet_json,
      accounting_packet_csv: artifacts.accounting_packet_csv,
      audit_bundle_jsonl: artifacts.audit_bundle_jsonl,
    },
  };

  await params.stores.idempotency.setOutcome({
    merchant_id: intent.merchant_id,
    idempotency_key: intent.idempotency_key,
    request_hash: reqHash,
    outcome,
  });
  await params.stores.replay.setPaymentRef({
    payment_ref: intent.payment_ref,
    entitlement_id: derivation.entitlement_id,
  });

  return outcome;
};
