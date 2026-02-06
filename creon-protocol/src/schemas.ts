import { z } from "zod";

const HexSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/, "Expected 0x-prefixed hex string") as z.ZodType<`0x${string}`>;

export const PurchaseIntentSchema = z.object({
  merchant_id: z.string().min(1),
  buyer: HexSchema,
  product_id: z.string().min(1),
  amount: z.string().min(1),
  currency: z.string().min(1),
  payment_ref: z.string().min(1),
  idempotency_key: z.string().min(1),
});

export const PaymentProofSchema = z.object({
  kind: z.literal("x402"),
  receipt: z.unknown(),
});

export const AccessIntentSchema = z.object({
  merchant_id: z.string().min(1),
  buyer: HexSchema,
  product_id: z.string().min(1),
});

export const ReceiptSchema = z.object({
  version: z.string().min(1),
  merchant_id: z.string().min(1),
  buyer: HexSchema,
  product_id: z.string().min(1),
  payment_ref: z.string().min(1),
  entitlement_id: HexSchema,
  tx_hash: HexSchema,
  workflow_version: z.string().min(1),
  policy_version: z.string().min(1),
  issued_at: z.string().min(1),
});
