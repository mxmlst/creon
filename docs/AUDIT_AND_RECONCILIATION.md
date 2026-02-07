# Audit & Reconciliation Guide

This guide explains how finance and ops teams validate purchases.

## What to keep

From each purchase:

- `receipt.json`
- `accounting_packet.json` and `accounting_packet.csv`
- `audit_bundle.jsonl`

## How to reconcile

1. **Verify receipt hash**
   - Recompute the receipt hash from the receipt JSON.
2. **Match accounting packet**
   - Ensure the cash + revenue lines match expected pricing.
3. **Verify chain tx**
   - Use `tx_hash` to confirm the entitlement mint onchain.

## Determinism

Artifacts are deterministic for the same input and idempotency key.

## Example commands

```bash
cast receipt <tx_hash> --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```
