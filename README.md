# creon

Creon is a commerce entitlement system built on **Chainlink CRE**.

It solves a common agentic commerce problem: **re-unlocking paid content without paying twice**.

Flow summary:

- A buyer (human or AI agent) pays once via **x402** to purchase a product.
- A **CRE workflow** validates the purchase and writes an **onchain entitlement** keyed by `(merchant, buyer wallet, product)`.
- Later, the same buyer re-unlocks the product by proving wallet ownership. The **CRE workflow reads the entitlement onchain** and returns an unlock grant with no second payment.

Repo packages:

- `creon-workflow/` CRE workflows (TypeScript): purchase and re-unlock
- `x402-shop/` Next.js demo store: pay once, re-unlock later
- `creon-sdk/` TS/JS SDK for merchants and services
- `contracts/` Minimal EVM contracts: EntitlementRegistry (and optional ReceiptAnchor)

---

## x402 as payment for consuming CRE workflows

Coinbase x402 is a micropayment pattern that lets clients (including AI agents) pay and call a service in a single request by attaching a proof of payment receipt to the API call. The service verifies the receipt and then executes, enabling pay per use access without long lived keys or custom billing plumbing.

Creon uses x402 for the **purchase** call only. Re-unlock is free because entitlement is already recorded onchain.

---

## What products support re-unlock

Re-unlock applies to products where the buyer should not pay again for future access.

Included in this demo:

1. **Paid article or report**

- Product id: `article:<id>`
- Entitlement: perpetual access
- Re-unlock returns an access token for the content endpoint

2. **Digital download (PDF, dataset snapshot, template pack)**

- Product id: `file:<id>`
- Entitlement: perpetual or limited downloads
- Re-unlock returns a signed download grant

3. **Time based access pass (API pass 24h, 30d membership)**

- Product id: `pass:<id>`
- Entitlement: expiry based
- Re-unlock returns a session token valid for remaining time

4. **Replay access (event replay, course module)**

- Product id: `replay:<id>`
- Entitlement: replay window expiry
- Re-unlock returns a stream access grant

Not targeted in this repo:

- Physical inventory fulfillment. Inventory systems can integrate as adapters, but re-unlock is not the primitive.

---

## Architecture

### Contract: EntitlementRegistry

Onchain source of truth for “who owns what.”

Keyed by:

- `merchant_id`
- `buyer` (wallet address)
- `product_id` (or sku + resource id)

Stores:

- status (active or revoked)
- validity window (valid_from, valid_until)
- optional usage limits (max_uses, uses)
- metadata hash (optional)

### Workflow A: Purchase workflow (paid)

Triggered after the gateway verifies x402 payment.

Input: `PurchaseIntent`

- merchant_id, buyer, product_id
- amount, currency
- payment_ref (hash of x402 receipt)
- idempotency_key

CRE stages:

1. HTTP Trigger receives PurchaseIntent
2. Validate schema
3. Idempotency and replay prevention
4. EVM Read: entitlement exists?
5. EVM Write: grant entitlement if not exists
6. Generate artifacts (receipt, accounting packet, audit bundle)
7. Return artifacts + tx reference

### Workflow B: Re-unlock workflow (unpaid)

Triggered when a buyer wants to access again.

Input: `AccessIntent`

- merchant_id, buyer, product_id

CRE stages:

1. HTTP Trigger receives AccessIntent
2. EVM Read: load entitlement
3. Policy checks: active, not expired, usage remaining
4. Optional EVM Write: increment uses (if product enforces max uses)
5. Return UnlockGrant:

- content token, signed url, api session token, or stream grant

---

## What the workflow outputs

Every purchase produces three concrete artifacts:

1. Receipt JSON (`receipt.json`)

- links purchase intent to entitlement tx hash
- includes workflow and policy versions
- deterministic receipt hash

2. Accounting Packet (`accounting_packet.csv` and `accounting_packet.json`)

- journal entry style lines for reconciliation

3. Audit Bundle (`audit_bundle.jsonl`)

- append only event timeline including onchain writes

Re-unlock produces:

- UnlockGrant (access token or signed url)
- optional audit events
- optional usage increment tx reference

---

## Demo walkthrough

1. Open the shop UI and buy an article using x402
2. The purchase workflow writes entitlement onchain
3. Close the tab
4. Return later and click re-unlock on the same article
5. The re-unlock workflow reads entitlement onchain and returns access without payment

---

## Repo components

- `x402-shop` handles:
  - 402 responses and x402 verification
  - calling workflows via `creon-sdk`
- `creon-workflow` handles:
  - deterministic execution
  - idempotency and replay rules
  - onchain entitlement writes and reads
  - artifact generation
- `contracts` handles:
  - the onchain EntitlementRegistry source of truth
- `creon-sdk` handles:
  - intent construction
  - workflow calls
  - receipt and artifact parsing

---

## Getting started

Prereqs:

- Node.js 20+
- pnpm
- CRE CLI installed and configured
- An EVM testnet RPC (Sepolia recommended for demo)
- A wallet for deploying the EntitlementRegistry

Install:

```bash
pnpm install
```

Deploy contract:

```bash
pnpm --filter contracts deploy:sepolia
```

Run the demo shop:

```bash
pnpm --filter x402-shop dev
```

Simulate workflows locally:

```bash
pnpm --filter creon-workflow workflow:simulate
```

---

## License

Apache License 2.0
