# Creon x402 Next App (Phase 5)

This Next.js app demos **pay once, re-unlock later** with x402-style payment negotiation and CRE workflows.

## Prereqs

- `cre` CLI on PATH
- Sepolia RPC configured in `project.yaml`
- `creon-workflow/config.staging.json` points to your deployed `EntitlementRegistry`
- `THIRDWEB_SECRET_KEY` set for x402 verification
- `X402_PAY_TO` set to your payment receiver address
- Optional: set `DISABLE_BROADCAST=1` to run without onchain writes
- A wallet (e.g., MetaMask) for client-side payment

## Run

```bash
pnpm --filter x402-next-app dev
```

The app calls `cre workflow simulate` under the hood.

## Environment

These are optional; defaults are provided:

```
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_client_id
THIRDWEB_SECRET_KEY=your_secret_key
X402_PAY_TO=0xYourReceiverAddress
X402_NETWORK=eip155:11155111
X402_CHAIN_ID=11155111
DISABLE_BROADCAST=1
```
