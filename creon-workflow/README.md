# Creon Purchase Workflow

This workflow implements Phase 3: paid purchase via HTTP, idempotency + replay protection, onchain entitlement mint,
and deterministic artifacts (receipt, accounting packet, audit bundle).

## Config

`config.staging.json` and `config.production.json` require:

```json
{
  "chain": "ethereum-testnet-sepolia",
  "entitlement_registry": "0x0000000000000000000000000000000000000000",
  "workflow_version": "0.0.0",
  "policy_version": "0.0.0",
  "idempotency_db_path": "./.creon-idempotency.sqlite",
  "authorized_keys": []
}
```

## HTTP Input

The HTTP trigger expects JSON:

```json
{
  "action": "purchase",
  "intent": {
    "merchant_id": "demo-merchant",
    "buyer": "0x000000000000000000000000000000000000dEaD",
    "product_id": "article:42",
    "amount": "10.00",
    "currency": "USD",
    "payment_ref": "x402:receipt:abc123",
    "idempotency_key": "idemp-1"
  },
  "payment_proof": {
    "kind": "x402",
    "receipt": {
      "id": "abc123"
    }
  }
}
```

For re-unlock:

```json
{
  "action": "reunlock",
  "intent": {
    "merchant_id": "demo-merchant",
    "buyer": "0x000000000000000000000000000000000000dEaD",
    "product_id": "article:42"
  }
}
```

## Simulate via CRE CLI

```bash
cre workflow simulate ./creon-workflow --target=staging-settings
```
