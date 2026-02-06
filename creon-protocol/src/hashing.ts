import { encodeAbiParameters, keccak256, toHex } from "viem";

import type { EntitlementDerivation, Hex, Receipt } from "./types";
import type { StableJson } from "./stableJson";
import { stableStringify } from "./stableJson";

export const hashUtf8 = (value: string): Hex => keccak256(toHex(value));

export const deriveEntitlementId = (params: {
  merchant_id: string;
  buyer: Hex;
  product_id: string;
}): EntitlementDerivation => {
  const merchant_id_hash = hashUtf8(params.merchant_id);
  const product_id_hash = hashUtf8(params.product_id);
  const encoded = encodeAbiParameters(
    [{ type: "bytes32" }, { type: "address" }, { type: "bytes32" }],
    [merchant_id_hash, params.buyer, product_id_hash]
  );
  const entitlement_id = keccak256(encoded);
  return { merchant_id_hash, product_id_hash, entitlement_id };
};

export const receiptHash = (receipt: Receipt): Hex => {
  const canonical = stableStringify(receipt as unknown as StableJson);
  return keccak256(toHex(canonical));
};
