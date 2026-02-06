import { spawnSync } from "node:child_process";

const rpcUrl = process.env.SEPOLIA_RPC_URL;
if (!rpcUrl) {
  console.error("Missing env var: SEPOLIA_RPC_URL");
  process.exit(2);
}

const result = spawnSync(
  "forge",
  [
    "script",
    "script/DeployEntitlementRegistry.s.sol:DeployEntitlementRegistry",
    "--rpc-url",
    rpcUrl,
    "--broadcast",
  ],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);
