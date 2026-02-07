import { AccessIntentSchema, deriveEntitlementId, type UnlockGrant } from "@creon/protocol";

import { ReunlockError } from "./errors";

export type ReunlockInput = {
  intent: unknown;
};

export type ReunlockConfig = {
  default_grant_ttl_seconds: number;
};

export type ReunlockEvm = {
  readEntitlement: (params: {
    merchant_id_hash: `0x${string}`;
    buyer: `0x${string}`;
    product_id_hash: `0x${string}`;
  }) => Promise<{
    active: boolean;
    valid_from: number;
    valid_until: number;
    max_uses: number;
    uses: number;
  }>;
  consumeEntitlement: (params: {
    merchant_id_hash: `0x${string}`;
    buyer: `0x${string}`;
    product_id_hash: `0x${string}`;
  }) => Promise<{ tx_hash: `0x${string}` }>;
};

const nowSeconds = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

export const processReunlock = async (params: {
  input: ReunlockInput;
  evm: ReunlockEvm;
  config: ReunlockConfig;
  issued_at: string;
  log?: (step: number, message: string, data?: Record<string, unknown>) => void;
}): Promise<{ grant: UnlockGrant; tx_hash?: `0x${string}` }> => {
  params.log?.(1, "validate input");
  const intent = AccessIntentSchema.parse(params.input.intent);
  params.log?.(1, "input validated", {
    merchant_id: intent.merchant_id,
    product_id: intent.product_id,
    buyer: intent.buyer,
  });

  params.log?.(2, "derive entitlement id");
  const derivation = deriveEntitlementId({
    merchant_id: intent.merchant_id,
    buyer: intent.buyer,
    product_id: intent.product_id,
  });

  params.log?.(3, "read entitlement onchain");
  const entitlement = await params.evm.readEntitlement({
    merchant_id_hash: derivation.merchant_id_hash,
    buyer: intent.buyer,
    product_id_hash: derivation.product_id_hash,
  });

  if (!entitlement.active) {
    throw new ReunlockError("NO_ENTITLEMENT", "entitlement not found or inactive");
  }

  if (entitlement.valid_until !== 0 && nowSeconds(params.issued_at) > entitlement.valid_until) {
    throw new ReunlockError("ENTITLEMENT_EXPIRED", "entitlement expired");
  }

  if (entitlement.max_uses !== 0 && entitlement.uses >= entitlement.max_uses) {
    throw new ReunlockError("USES_EXCEEDED", "entitlement usage exceeded");
  }

  let tx_hash: `0x${string}` | undefined;
  if (entitlement.max_uses !== 0) {
    params.log?.(4, "consume entitlement usage");
    const tx = await params.evm.consumeEntitlement({
      merchant_id_hash: derivation.merchant_id_hash,
      buyer: intent.buyer,
      product_id_hash: derivation.product_id_hash,
    });
    tx_hash = tx.tx_hash;
  }

  params.log?.(5, "entitlement allowed", { tx_hash });
  const expiresAt = new Date(
    new Date(params.issued_at).getTime() + params.config.default_grant_ttl_seconds * 1000
  ).toISOString();

  const grant: UnlockGrant = {
    kind: "content_token",
    token: `unlock:${derivation.entitlement_id}`,
    expires_at: expiresAt,
  };

  return { grant, tx_hash };
};
