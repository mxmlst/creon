# Wrap-Up: End-to-End & What’s Next (Creon)

This is a concise, step-by-step wrap-up of the full Creon flow, mirroring the bootcamp “complete workflow” style.

---

## Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  0. DEPLOY CONTRACT (Foundry)                                               │
│     └─► EntitlementRegistry deployed on Sepolia                             │
│                                                                             │
│  1. PURCHASE (HTTP Trigger, x402 paid)                                       │
│     └─► HTTP Request → CRE Workflow → EVM Write → Entitlement Minted        │
│                                                                             │
│  2. RE-UNLOCK (HTTP Trigger, unpaid)                                         │
│     └─► HTTP Request → CRE Workflow → EVM Read (+ optional Consume)         │
│                                                                             │
│  3. ARTIFACTS (Deterministic)                                                │
│     └─► Receipt + Accounting Packet + Audit Bundle                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 0: Deploy Contract

```
cd contracts

export CRE_ETH_PRIVATE_KEY=

forge script script/DeployEntitlementRegistry.s.sol:DeployEntitlementRegistry --rpc-url "https://ethereum-sepolia-rpc.publicnode.com" --broadcast --private-key "$CRE_ETH_PRIVATE_KEY"


```

Update `creon-workflow/config.staging.json` (and/or production) with:

```
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

Simulate the workflow:

```
export SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
cre workflow simulate ./creon-workflow --target=staging-settings

cre workflow simulate ./creon-workflow --target=staging-settings --broadcast
```

Select HTTP trigger and send:

```
creon-workflow/fixtures/purchase.json
```

Or paste JSON directly:

```
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

Expected: entitlement is minted onchain, and artifacts are returned.

---

## Step 2: Re-Unlock (Unpaid)

Simulate the workflow:

```
cre workflow simulate ./creon-workflow --target=staging-settings
```

Select HTTP trigger and send:

```
./creon-workflow/fixtures/reunlock.json
```

Or paste JSON directly:

```
{
  "action": "reunlock",
  "intent": {
    "merchant_id": "demo-merchant",
    "buyer": "0x000000000000000000000000000000000000dEaD",
    "product_id": "article:42"
  }
}
```

Expected: entitlement is read onchain; if usage-limited, consumes one use; returns an unlock grant.

---

## Runtime Logs (Bootcamp-Style)

The workflow logs are formatted as:

```
runtime.log(`[DEBUG] Step X: ...`);
runtime.log(`[DEBUG] Step X data: ${JSON.stringify(data)}`);
```

Example (purchase):

```
[DEBUG] CRE Workflow: purchase
[DEBUG] Step 1: validate input
[DEBUG] Step 1 data: {"merchant_id":"demo-merchant","product_id":"article:42","buyer":"0x..."}
[DEBUG] Step 2: idempotency hit
...
[DEBUG] Step 8: purchase done
[DEBUG] Step 8 data: {"minted":true,"tx_hash":"0x...","entitlement_id":"0x..."}
```

Example (re-unlock):

```
[DEBUG] CRE Workflow: reunlock
[DEBUG] Step 1: validate input
[DEBUG] Step 3: read entitlement onchain
[DEBUG] Step 5: entitlement allowed
[DEBUG] Step 6: reunlock done
```

---

## If It Hangs After "Running trigger..."

If you see `Running trigger ...` with no `[DEBUG]` logs:

- Ensure `project.yaml` has an RPC for `ethereum-testnet-sepolia`.
- Ensure `creon-workflow/config.staging.json` has the deployed `entitlement_registry`.
- The workflow logs `Step 0: init idempotency store`. In the simulator (WASM), SQLite init can hang, so the workflow auto-falls back to an in-memory store.

---

## What's Next

Ideas to extend:

1. Add real x402 verification (Phase 6)
2. Expand unlock grant types (signed URL, session token)
3. Add monitoring & dashboards for workflow steps
4. Ship the shop UI (Phase 5)


```
cast keccak "demo-merchant"
0x5e97d756f081c7f319fa02f31a09e82dd52d0191a7564f1b832505a22d36106f

cast keccak "article:42"
0x9a472f474fde5e69ea7d7031f475ae1f418b76fbb0909ee926060dc0af89d16d

cast call 0x86C7537A999fD380D194634e643c116777b75814 "getEntitlement(bytes32,address,bytes32)(bool,uint64,uint64,uint32,uint32,bytes32)" 0x5e97d756f081c7f319fa02f31a09e82dd52d0191a7564f1b832505a22d36106f 0x000000000000000000000000000000000000dEaD 0x9a472f474fde5e69ea7d7031f475ae1f418b76fbb0909ee926060dc0af89d16d --rpc-url https://ethereum-sepolia-rpc.publicnode.com

cast receipt 0xe8f93e2e8723719a0a3566201e25ede9f70286f8f8dc31529d5ab0a21339769b --rpc-url https://ethereum-sepolia-rpc.publicnode.com


cast call 0x86C7537A999fD380D194634e643c116777b75814 "getForwarderAddress()(address)" --rpc-url https://ethereum-sepolia-rpc.publicnode.com


cast send 0x86C7537A999fD380D194634e643c116777b75814 "setForwarderAddress(address)" 0x15fC6ae953E024d975e77382eEeC56A9101f9F88 --private-key "$CRE_ETH_PRIVATE_KEY" --rpc-url https://ethereum-sepolia-rpc.publicnode.com

export CRE_FORWARDER_ADDRESS=0x15fC6ae953E024d975e77382eEeC56A9101f9F88

cd /m/creon/contracts
forge script script/DeployEntitlementRegistry.s.sol:DeployEntitlementRegistry --rpc-url https://ethereum-sepolia-rpc.publicnode.com --broadcast


```