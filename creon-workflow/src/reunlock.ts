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
}): Promise<{ grant: UnlockGrant; tx_hash?: `0x${string}` }> => {
  const intent = AccessIntentSchema.parse(params.input.intent);

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
    const tx = await params.evm.consumeEntitlement({
      merchant_id_hash: derivation.merchant_id_hash,
      buyer: intent.buyer,
      product_id_hash: derivation.product_id_hash,
    });
    tx_hash = tx.tx_hash;
  }

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
