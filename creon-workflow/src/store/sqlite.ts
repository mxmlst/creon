import fs from "node:fs/promises";
import path from "node:path";

import initSqlJs, { type Database, type SqlValue } from "sql.js";

import type { IdempotencyStore, ReplayStore, StoredPurchaseOutcome } from "./types";

type SqlJsDatabase = Database;

export class SqliteStore implements IdempotencyStore, ReplayStore {
  private db: SqlJsDatabase;
  private dbPath: string;

  private constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  static async open(dbPath: string) {
    const SQL = await initSqlJs();
    let db: SqlJsDatabase;

    try {
      const buffer = await fs.readFile(dbPath);
      db = new SQL.Database(buffer) as SqlJsDatabase;
    } catch {
      db = new SQL.Database() as SqlJsDatabase;
    }

    const store = new SqliteStore(db as SqlJsDatabase, dbPath);
    store.migrate();
    return store;
  }

  private migrate() {
    this.db.run(
      `CREATE TABLE IF NOT EXISTS idempotency (
        merchant_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        outcome_json TEXT NOT NULL,
        PRIMARY KEY (merchant_id, idempotency_key)
      )`
    );

    this.db.run(
      `CREATE TABLE IF NOT EXISTS replay (
        payment_ref TEXT PRIMARY KEY,
        entitlement_id TEXT NOT NULL
      )`
    );
  }

  private async persist() {
    const dir = path.dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });
    const data = this.db.export();
    await fs.writeFile(this.dbPath, Buffer.from(data));
  }

  async getOutcome(params: { merchant_id: string; idempotency_key: string }) {
    const stmt = this.db.prepare(
      "SELECT request_hash, outcome_json FROM idempotency WHERE merchant_id = ? AND idempotency_key = ?"
    );
    stmt.bind([params.merchant_id, params.idempotency_key] as SqlValue[]);
    const hasRow = stmt.step();
    if (!hasRow) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return {
      request_hash: row.request_hash as `0x${string}`,
      outcome: JSON.parse(row.outcome_json as string) as StoredPurchaseOutcome,
    };
  }

  async setOutcome(params: {
    merchant_id: string;
    idempotency_key: string;
    request_hash: `0x${string}`;
    outcome: StoredPurchaseOutcome;
  }) {
    this.db.run(
      "INSERT OR REPLACE INTO idempotency (merchant_id, idempotency_key, request_hash, outcome_json) VALUES (?, ?, ?, ?)",
      [
        params.merchant_id,
        params.idempotency_key,
        params.request_hash,
        JSON.stringify(params.outcome),
      ] as SqlValue[]
    );
    await this.persist();
  }

  async getPaymentRef(payment_ref: string) {
    const stmt = this.db.prepare("SELECT entitlement_id FROM replay WHERE payment_ref = ?");
    stmt.bind([payment_ref] as SqlValue[]);
    const hasRow = stmt.step();
    if (!hasRow) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return { entitlement_id: row.entitlement_id as `0x${string}` };
  }

  async setPaymentRef(params: { payment_ref: string; entitlement_id: `0x${string}` }) {
    this.db.run("INSERT OR REPLACE INTO replay (payment_ref, entitlement_id) VALUES (?, ?)", [
      params.payment_ref,
      params.entitlement_id,
    ] as SqlValue[]);
    await this.persist();
  }
}
