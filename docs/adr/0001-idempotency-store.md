# ADR 0001: Local idempotency + replay store

Status: Accepted

## Context

Creon workflows need:

- **Idempotency** for `(merchant_id, idempotency_key)` so retries return the same outcome.
- **Replay prevention** so `payment_ref` cannot be reused to mint multiple entitlements.

During local dev and for deterministic tests, we need a small, file-backed store.

## Decision

Use **SQLite** (single file DB) as the local store for:

- idempotency keys (intent hash → outcome/artifacts refs)
- replay keys (`payment_ref` → entitlement key)

## Consequences

- Deterministic and inspectable state in local runs/CI.
- Easy to reset between tests by deleting the DB file.
- Production can swap this out behind an interface later if needed.
