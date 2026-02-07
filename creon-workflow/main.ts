import { HTTPCapability, handler, Runner, type Runtime } from "@chainlink/cre-sdk";

import { PurchaseError, ReunlockError } from "./src/errors";
import { createEvmAdapter } from "./src/evm";
import { processPurchase } from "./src/purchase";
import { processReunlock } from "./src/reunlock";
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

let storePromise: Promise<SqliteStore> | null = null;

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
  const store = await getStore(runtime.config.idempotency_db_path || "./.creon-idempotency.sqlite");
  const evm = createEvmAdapter(runtime, {
    chain: runtime.config.chain,
    entitlement_registry: runtime.config.entitlement_registry,
  });

  try {
    if (action === "reunlock") {
      const result = await processReunlock({
        input: { intent },
        evm,
        config: { default_grant_ttl_seconds: runtime.config.default_grant_ttl_seconds },
        issued_at,
      });
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
    });

    return { ok: true, outcome };
  } catch (err) {
    if (err instanceof PurchaseError) {
      runtime.log(`purchase error: ${err.code} ${err.message}`);
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    if (err instanceof ReunlockError) {
      runtime.log(`reunlock error: ${err.code} ${err.message}`);
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    runtime.log(`workflow error: ${String(err)}`);
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
