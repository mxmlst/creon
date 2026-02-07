# Complete Workflow (Creon)

This is the end‑to‑end, step‑by‑step guide for running the Creon workflows with CRE CLI.
It includes common debug checks and known gotchas (Windows + Git Bash).

---

## Step 0: Deploy EntitlementRegistry (Sepolia)

What this does: deploys the on‑chain EntitlementRegistry (source of truth for entitlements).

```bash
cd contracts
export CRE_ETH_PRIVATE_KEY=...
forge script script/DeployEntitlementRegistry.s.sol:DeployEntitlementRegistry \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --broadcast \
  --private-key "$CRE_ETH_PRIVATE_KEY"
```

Then update `creon-workflow/config.staging.json`:

```json
{
  "chain": "ethereum-testnet-sepolia",
  "entitlement_registry": "0xYOUR_DEPLOYED_ADDRESS",
  "workflow_version": "0.0.0",
  "policy_version": "0.0.0",
  "idempotency_db_path": "./.creon-idempotency.sqlite",
  "default_grant_ttl_seconds": 3600,
  "authorized_keys": []
}
```

---

## Step 1: Purchase (Paid)

What this does: validates input, verifies payment proof, checks idempotency + replay,
then mints entitlement onchain and returns artifacts.

### Non‑interactive (recommended, no prompts)

**Git Bash (absolute path works best):**

```bash
cre workflow simulate ./creon-workflow --target=staging-settings \
  --non-interactive --trigger-index=0 \
  --http-payload @/m/creon/creon-workflow/fixtures/purchase.json \
  --broadcast
```

**PowerShell:**

```powershell
cre workflow simulate ./creon-workflow --target=staging-settings `
  --non-interactive --trigger-index=0 `
  --http-payload @M:\creon\creon-workflow\fixtures\purchase.json `
  --broadcast
```

### Interactive (paste JSON)

```bash
cre workflow simulate ./creon-workflow --target=staging-settings --broadcast
```

Paste JSON when prompted, then send EOF:

- Git Bash: `Ctrl+D`
- PowerShell: `Ctrl+Z`, then Enter

Payload:

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
    "receipt": { "id": "abc123" }
  }
}
```

Expected:
- `[DEBUG] Step 8: purchase done`
- `ok: true`
- `minted: true` (or `false` if entitlement already exists)
- `tx_hash` present when `--broadcast` is used

---

## Step 2: Re‑Unlock (Unpaid)

What this does: reads entitlement onchain and returns an unlock grant.

### Non‑interactive (recommended)

**Git Bash:**

```bash
cre workflow simulate ./creon-workflow --target=staging-settings \
  --non-interactive --trigger-index=0 \
  --http-payload @/m/creon/creon-workflow/fixtures/reunlock.json
```

**PowerShell:**

```powershell
cre workflow simulate ./creon-workflow --target=staging-settings `
  --non-interactive --trigger-index=0 `
  --http-payload @M:\creon\creon-workflow\fixtures\reunlock.json
```

### Interactive (paste JSON)

```bash
cre workflow simulate ./creon-workflow --target=staging-settings
```

Payload:

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

Expected:
- `ok: true`
- `grant` returned
- `tx_hash` zero unless you enable consume writes

---

## Debug: Check Entitlement On‑Chain

What this does: confirms if the entitlement exists for your buyer/product.

```bash
cast keccak "demo-merchant"
cast keccak "article:42"

cast call 0xYOUR_REGISTRY_ADDRESS \
  "getEntitlement(bytes32,address,bytes32)(bool,uint64,uint64,uint32,uint32,bytes32)" \
  <MERCHANT_HASH> 0x000000000000000000000000000000000000dEaD <PRODUCT_HASH> \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

If `active` is `false`, the entitlement was not minted (or hashes differ).

---

## Debug: Forwarder Mismatch (Most Common Cause of “Minted: no”)

Check the forwarder set on the registry:

```bash
cast call 0xYOUR_REGISTRY_ADDRESS "getForwarderAddress()(address)" \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

If the registry forwarder does not match the CRE forwarder, update it:

```bash
cast send 0xYOUR_REGISTRY_ADDRESS \
  "setForwarderAddress(address)" 0x15fC6ae953E024d975e77382eEeC56A9101f9F88 \
  --private-key "$CRE_ETH_PRIVATE_KEY" \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

---

## Debug: Workflow Hangs After “Running trigger…”

- Ensure `project.yaml` has Sepolia RPC under `staging-settings`.
- Ensure `creon-workflow/config.staging.json` points to the deployed registry.
- In the simulator (WASM), SQLite can stall; the workflow falls back to in‑memory store.

---

## Notes

- **Broadcast required for on‑chain writes**: use `--broadcast` on purchase.
- **Same buyer + product** will return deterministic results (no mint) once entitlement exists.
- **Payment refs** must be unique to avoid replay errors.
