import { receiptHash, stableStringify, type Receipt, type StableJson } from "@creon/protocol";

export type PurchaseArtifacts = {
  receipt: Receipt;
  receipt_hash: `0x${string}`;
  accounting_packet_json: string;
  accounting_packet_csv: string;
  audit_bundle_jsonl: string;
};

const toCsv = (rows: string[][]): string => rows.map((r) => r.join(",")).join("\n") + "\n";

export const buildArtifacts = (params: {
  receipt: Receipt;
  entitlement_id: `0x${string}`;
  tx_hash: `0x${string}`;
  minted: boolean;
  amount: string;
}): PurchaseArtifacts => {
  const r: Receipt = {
    ...params.receipt,
    entitlement_id: params.entitlement_id,
    tx_hash: params.tx_hash,
  };

  const rHash = receiptHash(r);

  const accounting = {
    version: "1",
    receipt_hash: rHash,
    lines: [
      { account: "cash", debit: params.amount, credit: "0", memo: "purchase payment" },
      { account: "revenue", debit: "0", credit: params.amount, memo: "product sale" },
    ],
  } satisfies StableJson;

  const accounting_packet_json = JSON.stringify(accounting, null, 2);
  const accounting_packet_csv = toCsv([
    ["account", "debit", "credit", "memo"],
    ...accounting.lines.map((l) => [l.account, l.debit, l.credit, l.memo ?? ""]),
  ]);

  const auditEvents: StableJson[] = [
    { at: r.issued_at, type: "purchase.artifacts", data: { minted: params.minted } } as StableJson,
    { at: r.issued_at, type: "purchase.receipt", data: { receipt_hash: rHash } } as StableJson,
    { at: r.issued_at, type: "purchase.chain", data: { tx_hash: params.tx_hash } } as StableJson,
  ];

  const audit_bundle_jsonl = auditEvents.map((e) => stableStringify(e)).join("\n") + "\n";

  return {
    receipt: r,
    receipt_hash: rHash,
    accounting_packet_json,
    accounting_packet_csv,
    audit_bundle_jsonl,
  };
};
