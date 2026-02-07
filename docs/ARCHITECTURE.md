# Creon Architecture & Trust Boundaries

This document describes how Creon works end‑to‑end and where trust boundaries exist.

## Components

- **EntitlementRegistry (contracts/)**
  - On‑chain source of truth for entitlements.
  - Stores active status, validity windows, and optional usage limits.

- **CRE Workflows (creon-workflow/)**
  - Purchase: validates inputs, verifies x402 payment, mints entitlement, and produces artifacts.
  - Re‑unlock: checks entitlement and returns an unlock grant without payment.

- **Protocol (creon-protocol/)**
  - Shared types, schema validation, hashing rules, and deterministic artifacts.

- **Demo App (x402-next-app/)**
  - User‑facing UI that triggers purchase + re‑unlock.
  - Implements real x402 payment verification via thirdweb.

## Trust Boundaries

1. **Payment**
   - x402 verification is performed server‑side (purchase API).
   - Payment is accepted only if receipt is valid and amount is sufficient.

2. **Entitlement**
   - The EntitlementRegistry is the source of truth.
   - Re‑unlock decisions depend on on‑chain state.

3. **Artifacts**
   - Receipts, accounting packets, and audit bundles are deterministic.
   - Artifacts can be recomputed from inputs for verification.

## Failure Modes

- **Missing payment**: purchase rejects with 402.
- **Replay**: purchase rejects if payment_ref is reused with a different intent.
- **Entitlement not found**: re‑unlock denies.
- **Forwarder mismatch**: on‑chain write is rejected until forwarder is updated.

## Security Notes

- Do not store private keys in client‑side env. Use server‑side env only.
- Rotate keys periodically (CRE_ETH_PRIVATE_KEY, THIRDWEB_SECRET_KEY).
