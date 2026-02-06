# Re-unlock spec

Re-unlock is an unpaid call. It proves wallet ownership and checks onchain entitlements to return an access grant.

## Inputs

`AccessIntent` (shared protocol type):

- `merchant_id`
- `buyer`
- `product_id`

## Access checks

Re-unlock is allowed when the entitlement is:

- active
- not expired
- has remaining uses (if usage-limited)

For usage-limited products, the workflow may call `consumeEntitlement(...)` onchain to increment `uses`.

## Output

`UnlockGrant` (shared protocol type), a typed grant that can represent:

- content access token
- signed download URL
- API session token
- stream grant
