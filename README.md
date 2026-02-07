# Creon — Pay Once, Re‑Unlock Later

Creon is a commerce entitlement system built on **Chainlink CRE**. It solves a practical business problem: **buyers should not pay twice** to access the same product. Purchases mint an on‑chain entitlement; re‑unlock checks that entitlement and returns access without charging again.

**Why it matters (commerce‑friendly)**  
Creon automates the messy parts of post‑purchase access:

- **Payment validation** (x402)  
- **Entitlement creation** (on‑chain source of truth)  
- **Receipts + accounting packets** (ready for reconciliation)  
- **Audit trail** (deterministic, event‑by‑event)

This enables **agentic commerce** and conventional checkout flows with the same infrastructure.

---

## What’s in this repo (and why)

- `contracts/`  
  **EntitlementRegistry**: on‑chain source of truth for “who owns what.” Supports expiry and usage limits.

- `creon-workflow/`  
  CRE workflows for **purchase** (paid) and **re‑unlock** (unpaid). Handles idempotency, replay prevention, EVM reads/writes, and artifact generation.

- `creon-protocol/`  
  Shared types, schemas, hashing rules, and deterministic artifact generation utilities.

- `creon-sdk/`  
  Merchant‑friendly SDK for constructing intents and parsing artifacts (lightweight v1 scaffolding).

- `x402-next-app/`  
  **Production‑grade demo store** built with `create-next-app` and real x402 verification. Includes purchase + re‑unlock UI and artifact downloads.

---

## Architecture (high level)

### Contract: EntitlementRegistry

Keyed by `(merchant_id, buyer wallet, product_id)`, and stores:

- active / revoked status  
- validity window  
- optional usage limits  
- metadata hash  

### Workflow A: Purchase (paid)

1. Validate intent  
2. Verify x402 payment  
3. Enforce idempotency + replay protection  
4. Read on‑chain entitlement  
5. Mint if absent  
6. Emit **receipt + accounting + audit bundle**  

### Workflow B: Re‑unlock (unpaid)

1. Validate access intent  
2. Read entitlement  
3. Enforce policy checks (active, not expired, usage remaining)  
4. Optional consume (for usage‑limited products)  
5. Return unlock grant (token / signed URL / session)

---

## What Creon outputs (commerce‑ready artifacts)

Every purchase produces:

1. **Receipt JSON** (`receipt.json`)  
   - links intent to entitlement tx  
   - deterministic receipt hash  
2. **Accounting Packet** (`accounting_packet.json` + `.csv`)  
   - journal‑entry style lines  
3. **Audit Bundle** (`audit_bundle.jsonl`)  
   - append‑only timeline with chain references  

Re‑unlock returns:

- **UnlockGrant** (token or signed URL)  
- optional on‑chain consume tx hash

---

## Demo apps & routes

### `x402-next-app` (recommended)

Routes:

- `POST /api/purchase` — x402 payment + purchase workflow  
- `POST /api/reunlock` — re‑unlock workflow  

Features:

- Wallet‑based x402 payment flow  
- Broadcast on‑chain writes by default  
- Downloadable artifacts  

---

## Getting started

### Prereqs

- Node.js 20+  
- pnpm  
- CRE CLI installed and on PATH  
- Sepolia RPC in `project.yaml`  
- Wallet + RPC for deploying EntitlementRegistry  

### Install

Installs workspace dependencies for contracts, workflows, protocol, and demo app.

```bash
pnpm install
```

### Deploy EntitlementRegistry (Sepolia)

Deploys the on‑chain registry contract that stores entitlements (the source of truth).

```bash
pnpm --filter contracts deploy:sepolia
```

### Configure workflow (staging)

Points the CRE workflow at the deployed registry address so reads/writes go to the correct contract.

Update `creon-workflow/config.staging.json` with your deployed address:

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

### Run the demo app

Starts the Next.js demo store where you can purchase once and re‑unlock later.

```bash
pnpm --filter x402-next-app dev
```

---

## Environment (x402 + broadcast)

Required for `x402-next-app`:

```
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=...
THIRDWEB_SECRET_KEY=...
X402_PAY_TO=0xYourReceiverAddress
X402_CHAIN_ID=11155111
```

Optional:

```
DISABLE_BROADCAST=1   # opt‑out of on‑chain writes
```

CRE broadcast requires:

```
CRE_ETH_PRIVATE_KEY=...
```

---

## Simulations (CLI)

Manual simulate (non‑interactive):

Runs the purchase workflow from the CLI using a fixture payload (no interactive prompt).

```bash
cre workflow simulate ./creon-workflow --target=staging-settings \
  --non-interactive --trigger-index=0 \
  --http-payload @/m/creon/creon-workflow/fixtures/purchase.json \
  --broadcast

```

Re‑unlock:

Runs the re‑unlock workflow from the CLI using a fixture payload.

```bash
cre workflow simulate ./creon-workflow --target=staging-settings \
  --non-interactive --trigger-index=0 \
  --http-payload @/m/creon/creon-workflow/fixtures/reunlock.json
```

If you prefer interactive paste, see [Complete Workflow Guide](creon-workflow/COMPLETE_WORKFLOW.md).

---

## Tests

Run all tests:

```bash
pnpm test
```

Package‑specific:

```bash
pnpm --filter x402-next-app test
pnpm --filter creon-protocol test
pnpm --filter creon-workflow test
```

---

## Commercial integration (how teams use this)

- **Checkout teams** use purchase receipts as system‑of‑record and reconcile payments automatically.  
- **Content teams** plug unlock grants into delivery (CDN, signed URL, token gate).  
- **Risk teams** rely on deterministic artifacts + replay protection.  
- **Finance teams** get clean accounting lines without custom reconciliation code.

Creon is built to be a **merchant‑ready system of record** for pay‑once access.

---

## License

Apache License 2.0
