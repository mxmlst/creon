# Entitlement spec

This document defines the onchain entitlement model used by Creon.

## Keying

An entitlement is keyed by:

- `merchant_id` (string, offchain identifier)
- `buyer` (EVM address)
- `product_id` (string, merchant-defined identifier)

Onchain, the registry uses **hashed identifiers**:

- `merchant_id_hash = keccak256(utf8(merchant_id))` (`bytes32`)
- `product_id_hash = keccak256(utf8(product_id))` (`bytes32`)

The contract’s entitlement id is:

- `entitlement_id = keccak256(abi.encode(merchant_id_hash, buyer, product_id_hash))` (`bytes32`)

The shared protocol package implements the same derivations.

## Fields

Each entitlement stores:

- `active` (bool)
- `valid_from` (uint64 seconds since epoch)
- `valid_until` (uint64 seconds since epoch, `0` means no expiry)
- `max_uses` (uint32, `0` means unlimited)
- `uses` (uint32)
- `metadata_hash` (`bytes32`, optional: `0x0` means none)

## Policy rules

An entitlement is eligible for access when:

- `active == true`
- `valid_until == 0 || now <= valid_until`
- `max_uses == 0 || uses < max_uses`

If `max_uses > 0`, consuming access increments `uses` by 1 (onchain).
