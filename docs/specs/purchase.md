# Purchase spec

The purchase workflow is the only paid call. It is expected to be invoked after x402 receipt verification at the
gateway/service boundary.

## Inputs

`PurchaseIntent` (shared protocol type):

- `merchant_id`
- `buyer` (wallet address)
- `product_id`
- `amount` (string or integer minor units; see protocol schema)
- `currency` (e.g. `USD`, `USDC`)
- `payment_ref` (hash/identifier derived from the payment receipt)
- `idempotency_key` (merchant-provided stable key)

## Non-negotiables

- **Idempotency:** same `(merchant_id, idempotency_key)` returns identical outcome.
- **Replay prevention:** `payment_ref` may not be used to mint multiple entitlements.

## Onchain mint

On success, the workflow mints (or confirms) an onchain entitlement in `EntitlementRegistry`.

## Outputs (artifacts)

See `artifacts.md` for the concrete outputs:

- `receipt.json`
- accounting packet
- audit bundle
