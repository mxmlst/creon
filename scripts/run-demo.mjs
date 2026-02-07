import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();

const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

console.log("== Creon Demo ==");

console.log("1) Install dependencies");
run("pnpm", ["install"], { cwd: root });

console.log("2) Simulate purchase (broadcast)");
run("cre", [
  "workflow",
  "simulate",
  "./creon-workflow",
  "--target=staging-settings",
  "--non-interactive",
  "--trigger-index=0",
  "--http-payload",
  "@./creon-workflow/fixtures/purchase.json",
  "--broadcast",
], { cwd: root });

console.log("3) Simulate re-unlock");
run("cre", [
  "workflow",
  "simulate",
  "./creon-workflow",
  "--target=staging-settings",
  "--non-interactive",
  "--trigger-index=0",
  "--http-payload",
  "@./creon-workflow/fixtures/reunlock.json",
], { cwd: root });

console.log("4) Start demo app (x402-next-app)");
run("pnpm", ["--filter", "x402-next-app", "dev"], { cwd: root });
