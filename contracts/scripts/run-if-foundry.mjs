import { spawnSync } from "node:child_process";

const isCi = process.env.CI === "true";

const command = process.argv[2];
const args = process.argv.slice(3);

if (!command) {
  console.error("usage: run-if-foundry.mjs <cmd> [args...]");
  process.exit(2);
}

const foundryCheck = spawnSync("forge", ["--version"], { stdio: "ignore" });
if (foundryCheck.status !== 0) {
  if (isCi) {
    console.error("Foundry is required in CI but `forge` is not available.");
    process.exit(1);
  }
  console.warn("Skipping contracts command: Foundry (`forge`) is not available on PATH.");
  process.exit(0);
}

const result = spawnSync(command, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
