import { EVMClient, Report, type Runtime } from "@chainlink/cre-sdk";
import { decodeFunctionResult, encodeAbiParameters, encodeFunctionData, getAddress } from "viem";

import { PurchaseError } from "./errors";
import { bytesToHex, hexToBase64 } from "./encoding";
import type { PurchaseEvm } from "./purchase";
import type { ReunlockEvm } from "./reunlock";

const registryAbi = [
  {
    name: "getEntitlement",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "merchantIdHash", type: "bytes32" },
      { name: "buyer", type: "address" },
      { name: "productIdHash", type: "bytes32" },
    ],
    outputs: [
      { name: "active", type: "bool" },
      { name: "validFrom", type: "uint64" },
      { name: "validUntil", type: "uint64" },
      { name: "maxUses", type: "uint32" },
      { name: "uses", type: "uint32" },
      { name: "metadataHash", type: "bytes32" },
    ],
  },
  {
    name: "consumeEntitlement",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "merchantIdHash", type: "bytes32" },
      { name: "buyer", type: "address" },
      { name: "productIdHash", type: "bytes32" },
    ],
    outputs: [{ name: "newUses", type: "uint32" }],
  },
] as const;

const actionGrant = 1;
const actionConsume = 3;

export type EvmConfig = {
  chain: keyof typeof EVMClient.SUPPORTED_CHAIN_SELECTORS;
  entitlement_registry: `0x${string}`;
};

export const createEvmAdapter = (
  runtime: Runtime<unknown>,
  config: EvmConfig
): PurchaseEvm & ReunlockEvm => {
  const selector = EVMClient.SUPPORTED_CHAIN_SELECTORS[config.chain];
  if (!selector) {
    throw new PurchaseError("CHAIN_ERROR", `Unsupported chain selector: ${config.chain}`);
  }

  const client = new EVMClient(selector);
  const contractAddress = getAddress(config.entitlement_registry);

  return {
    async readEntitlement(params) {
      const dataHex = encodeFunctionData({
        abi: registryAbi,
        functionName: "getEntitlement",
        args: [params.merchant_id_hash, params.buyer, params.product_id_hash],
      });

      const reply = client
        .callContract(runtime, {
          call: {
            to: hexToBase64(contractAddress),
            data: hexToBase64(dataHex),
          },
        })
        .result();

      const decoded = decodeFunctionResult({
        abi: registryAbi,
        functionName: "getEntitlement",
        data: bytesToHex(reply.data),
      }) as [boolean, bigint, bigint, number, number, `0x${string}`];

      return {
        active: decoded[0],
        valid_from: Number(decoded[1]),
        valid_until: Number(decoded[2]),
        max_uses: decoded[3],
        uses: decoded[4],
      };
    },

    async writeGrant(params) {
      const reportData = encodeAbiParameters(
        [
          { name: "merchantIdHash", type: "bytes32" },
          { name: "buyer", type: "address" },
          { name: "productIdHash", type: "bytes32" },
          { name: "validUntil", type: "uint64" },
          { name: "maxUses", type: "uint32" },
          { name: "metadataHash", type: "bytes32" },
        ],
        [
          params.merchant_id_hash,
          params.buyer,
          params.product_id_hash,
          BigInt(params.valid_until),
          params.max_uses,
          params.metadata_hash,
        ]
      );

      const rawReport =
        `0x${actionGrant.toString(16).padStart(2, "0")}${reportData.slice(2)}` as `0x${string}`;
      const report = new Report({
        configDigest: hexToBase64("0x"),
        seqNr: "0",
        reportContext: hexToBase64("0x"),
        rawReport: hexToBase64(rawReport),
        sigs: [],
      });

      const result = client
        .writeReport(runtime, {
          receiver: contractAddress,
          report,
        })
        .result();

      if (result.txStatus !== 2) {
        throw new PurchaseError("CHAIN_ERROR", result.errorMessage ?? "EVM writeReport failed");
      }

      const txHash = result.txHash
        ? bytesToHex(result.txHash)
        : (("0x" + "0".repeat(64)) as `0x${string}`);
      return { tx_hash: txHash };
    },

    async consumeEntitlement(params) {
      const reportData = encodeAbiParameters(
        [
          { name: "merchantIdHash", type: "bytes32" },
          { name: "buyer", type: "address" },
          { name: "productIdHash", type: "bytes32" },
        ],
        [params.merchant_id_hash, params.buyer, params.product_id_hash]
      );

      const rawReport =
        `0x${actionConsume.toString(16).padStart(2, "0")}${reportData.slice(2)}` as `0x${string}`;
      const report = new Report({
        configDigest: hexToBase64("0x"),
        seqNr: "0",
        reportContext: hexToBase64("0x"),
        rawReport: hexToBase64(rawReport),
        sigs: [],
      });

      const result = client
        .writeReport(runtime, {
          receiver: contractAddress,
          report,
        })
        .result();

      if (result.txStatus !== 2) {
        throw new PurchaseError("CHAIN_ERROR", result.errorMessage ?? "EVM writeReport failed");
      }

      const txHash = result.txHash
        ? bytesToHex(result.txHash)
        : (("0x" + "0".repeat(64)) as `0x${string}`);
      return { tx_hash: txHash };
    },
  };
};
