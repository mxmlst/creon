# Artifact spec

Creon produces deterministic artifacts for reconciliation and audit.

## Receipt (`receipt.json`)

Minimum fields:

- `version`
- `merchant_id`
- `buyer`
- `product_id`
- `payment_ref`
- `entitlement_id`
- `tx_hash`
- `workflow_version`
- `policy_version`
- `issued_at` (RFC3339)

The receipt hash is computed deterministically from a canonical JSON form. See the shared protocol package for the
canonicalization + hashing rules.

## Accounting packet

Two representations:

- CSV (human-friendly)
- JSON (machine-friendly)

Both represent the same set of journal lines.

## Audit bundle

`audit_bundle.jsonl` contains an append-only sequence of audit events, including references to onchain tx hashes and
event ids when available.
