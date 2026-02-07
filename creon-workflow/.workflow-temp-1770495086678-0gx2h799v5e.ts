import { HTTPCapability, handler, Runner, type Runtime, sendErrorResponse } from "@chainlink/cre-sdk";

import { PurchaseError, ReunlockError } from "./src/errors";
import { createEvmAdapter } from "./src/evm";
import { logError, logFooter, logHeader, logStep } from "./src/logging";
import { processPurchase } from "./src/purchase";
import { processReunlock } from "./src/reunlock";
import type { IdempotencyStore, ReplayStore } from "./src/store/types";
import { MemoryStore } from "./src/store/memory";
import { SqliteStore } from "./src/store/sqlite";

type Config = {
  chain: keyof typeof import("@chainlink/cre-sdk").EVMClient.SUPPORTED_CHAIN_SELECTORS;
  entitlement_registry: `0x${string}`;
  workflow_version: string;
  policy_version: string;
  idempotency_db_path: string;
  default_grant_ttl_seconds: number;
  authorized_keys?: { type: "KEY_TYPE_ECDSA_EVM"; public_key: string }[];
};

let storePromise: Promise<IdempotencyStore & ReplayStore> | null = null;

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string) => {
  const timer = globalThis.setTimeout;
  if (typeof timer !== "function") {
    return promise;
  }
  let timeoutId: ReturnType<typeof timer> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = timer(() => reject(new Error(label)), ms);
  });
  const result = await Promise.race([promise, timeout]);
  if (timeoutId) globalThis.clearTimeout(timeoutId);
  return result;
};

const isNodeRuntime =
  typeof process !== "undefined" &&
  typeof process.versions?.node === "string" &&
  process.versions.node.length > 0;

const getStore = (dbPath: string) => {
  if (!storePromise) {
    storePromise = SqliteStore.open(dbPath);
  }
  return storePromise;
};

const onHttpTrigger = async (runtime: Runtime<Config>, payload: { input: Uint8Array }) => {
  const raw = new TextDecoder().decode(payload.input);
  const parsed = raw.length ? JSON.parse(raw) : {};

  const intent = parsed.intent ?? parsed;
  const payment_proof = parsed.payment_proof ?? parsed.paymentProof ?? parsed.paymentproof;
  const action = parsed.action ?? "purchase";

  const issued_at = new Date().toISOString();
  const log = (message: string) => runtime.log(message);
  logHeader(log, `CRE Workflow: ${action}`);
  logStep(log, 0, "init idempotency store");

  let store: IdempotencyStore & ReplayStore;
  if (!isNodeRuntime) {
    logError(log, "idempotency store fallback: non-Node runtime (using memory store)");
    store = new MemoryStore();
  } else {
    try {
      store = await withTimeout(
        getStore(runtime.config.idempotency_db_path || "./.creon-idempotency.sqlite"),
        5000,
        "idempotency store init timed out"
      );
    } catch (err) {
      logError(log, `idempotency store fallback: ${String(err)}`);
      store = new MemoryStore();
    }
  }

  let evm: PurchaseEvm & ReunlockEvm;
  try {
    evm = createEvmAdapter(runtime, {
      chain: runtime.config.chain,
      entitlement_registry: runtime.config.entitlement_registry,
    });
  } catch (err) {
    logError(log, `evm init failed: ${String(err)}`);
    logFooter(log);
    return { ok: false, error: { code: "CHAIN_ERROR", message: "evm init failed" } };
  }

  try {
    if (action === "reunlock") {
      const result = await processReunlock({
        input: { intent },
        evm,
        config: { default_grant_ttl_seconds: runtime.config.default_grant_ttl_seconds },
        issued_at,
        log: (step, message, data) => logStep(log, step, message, data),
      });
      logStep(log, 6, "reunlock done", {
        tx_hash: result.tx_hash ?? "0x" + "0".repeat(64),
      });
      logFooter(log);
      return {
        ok: true,
        grant: result.grant,
        tx_hash: result.tx_hash ?? "0x" + "0".repeat(64),
      };
    }

    const outcome = await processPurchase({
      input: { intent, payment_proof },
      stores: { idempotency: store, replay: store },
      evm,
      config: {
        workflow_version: runtime.config.workflow_version,
        policy_version: runtime.config.policy_version,
      },
      issued_at,
      log: (step, message, data) => logStep(log, step, message, data),
    });

    logStep(log, 8, "purchase done", {
      minted: outcome.minted,
      tx_hash: outcome.tx_hash,
      entitlement_id: outcome.entitlement_id,
    });
    logFooter(log);
    return { ok: true, outcome };
  } catch (err) {
    if (err instanceof PurchaseError) {
      logError(log, `purchase error: ${err.code} ${err.message}`);
      logFooter(log);
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    if (err instanceof ReunlockError) {
      logError(log, `reunlock error: ${err.code} ${err.message}`);
      logFooter(log);
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    logError(log, `workflow error: ${String(err)}`);
    logFooter(log);
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "unexpected error" } };
  }
};

const initWorkflow = (config: Config) => {
  const http = new HTTPCapability();
  return [
    handler(
      http.trigger({
        authorizedKeys: config.authorized_keys?.map((k) => ({
          type: k.type,
          publicKey: k.public_key,
        })),
      }),
      onHttpTrigger
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main().catch(sendErrorResponse)
