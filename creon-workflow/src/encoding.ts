export const hexToBase64 = (hex: string): string => {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length === 0) return "";
  return Buffer.from(clean, "hex").toString("base64");
};

export const bytesToHex = (bytes: Uint8Array): `0x${string}` => {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as `0x${string}`;
};
