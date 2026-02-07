export type X402Accept = {
  scheme: "exact";
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  resource: string;
  memo?: string;
};

export type X402PaymentRequired = {
  x402Version: number;
  error: string;
  accepts: X402Accept[];
};

export type X402PaymentSignature = {
  x402Version: number;
  scheme: "exact";
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  payer: string;
  payment_ref: string;
  memo?: string;
  timestamp: string;
};

export const getX402Config = () => ({
  version: 2,
  scheme: "exact" as const,
  network: process.env.X402_NETWORK ?? "eip155:11155111",
  asset: process.env.X402_ASSET ?? "ETH",
  payTo: process.env.X402_PAY_TO ?? "0x000000000000000000000000000000000000dEaD",
  timeoutSeconds: Number(process.env.X402_TIMEOUT_SECONDS ?? "300"),
});

export const buildPaymentRequired = (params: {
  resource: string;
  amount: string;
  memo?: string;
}): X402PaymentRequired => {
  const config = getX402Config();
  return {
    x402Version: config.version,
    error: "payment required",
    accepts: [
      {
        scheme: config.scheme,
        network: config.network,
        asset: config.asset,
        amount: params.amount,
        payTo: config.payTo,
        maxTimeoutSeconds: config.timeoutSeconds,
        resource: params.resource,
        memo: params.memo,
      },
    ],
  };
};

const encodeUtf8 = (value: string) => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }
  return btoa(unescape(encodeURIComponent(value)));
};

const decodeUtf8 = (value: string) => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(atob(value)));
};

export const encodeHeader = (value: object) => encodeUtf8(JSON.stringify(value));

export const decodeHeader = <T>(raw: string): T => {
  const normalized = raw.trim();
  const json = decodeUtf8(normalized);
  return JSON.parse(json) as T;
};

export const buildPaymentSignature = (params: {
  amount: string;
  payer: string;
  payment_ref: string;
  memo?: string;
}): X402PaymentSignature => {
  const config = getX402Config();
  return {
    x402Version: config.version,
    scheme: config.scheme,
    network: config.network,
    asset: config.asset,
    amount: params.amount,
    payTo: config.payTo,
    payer: params.payer,
    payment_ref: params.payment_ref,
    memo: params.memo,
    timestamp: new Date().toISOString(),
  };
};

export const isValidSignature = (
  signature: X402PaymentSignature,
  required: X402Accept
) => {
  return (
    signature.scheme === required.scheme &&
    signature.network === required.network &&
    signature.asset === required.asset &&
    signature.payTo.toLowerCase() === required.payTo.toLowerCase() &&
    Number(signature.amount) >= Number(required.amount)
  );
};
