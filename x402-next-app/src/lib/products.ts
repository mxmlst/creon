export type Product = {
  id: string;
  title: string;
  description: string;
  priceUsd: number;
  kind: "article" | "file" | "pass" | "replay";
};

export const products: Product[] = [
  {
    id: "article:42",
    title: "Signal Journal #42",
    description: "Deep-dive report with onchain provenance and audit trail.",
    priceUsd: 10,
    kind: "article",
  },
  {
    id: "file:drift-pack",
    title: "Drift Pack",
    description: "Downloadable pack with licensing bound to your entitlement.",
    priceUsd: 15,
    kind: "file",
  },
  {
    id: "pass:studio",
    title: "Studio Pass",
    description: "Usage-limited access token for premium sessions.",
    priceUsd: 25,
    kind: "pass",
  },
  {
    id: "replay:clinic",
    title: "Replay Clinic",
    description: "Replay entitlement, no re-payment after purchase.",
    priceUsd: 12,
    kind: "replay",
  },
];
