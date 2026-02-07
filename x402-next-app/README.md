# Creon x402 Next App (Phase 5)

This Next.js app demos **pay once, re-unlock later** with x402-style payment negotiation and CRE workflows.

## Prereqs

- `cre` CLI on PATH
- Sepolia RPC configured in `project.yaml`
- `creon-workflow/config.staging.json` points to your deployed `EntitlementRegistry`
- Optional: set `DISABLE_BROADCAST=1` to run without onchain writes

## Run

```bash
pnpm --filter x402-next-app dev
```

The app calls `cre workflow simulate` under the hood.

## Environment

These are optional; defaults are provided:

```
DISABLE_BROADCAST=1
X402_NETWORK=eip155:11155111
X402_ASSET=ETH
X402_PAY_TO=0x000000000000000000000000000000000000dEaD
X402_TIMEOUT_SECONDS=300
```
