export type StableJson =
  | null
  | boolean
  | number
  | string
  | StableJson[]
  | {
      [k: string]: StableJson;
    };

const isPlainObject = (value: unknown): value is { [k: string]: StableJson } => {
  if (typeof value !== "object" || value === null) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
};

export const stableStringify = (value: StableJson): string => {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("stableStringify: non-finite number is not supported");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;

  if (!isPlainObject(value)) {
    throw new Error("stableStringify: only plain objects are supported");
  }

  const keys = Object.keys(value).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k] ?? null)}`);
  return `{${parts.join(",")}}`;
};
