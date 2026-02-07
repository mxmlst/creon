import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type WorkflowResult = {
  ok: boolean;
  outcome?: {
    tx_hash?: string;
    [key: string]: unknown;
  };
  grant?: unknown;
  tx_hash?: string;
  error?: { code: string; message: string };
};

const parseWorkflowResult = (output: string): WorkflowResult => {
  const marker = "Workflow Simulation Result:";
  const markerIndex = output.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Workflow result not found in output");
  }
  const jsonStart = output.indexOf("{", markerIndex);
  if (jsonStart === -1) {
    throw new Error("Workflow JSON start not found");
  }
  const jsonText = output.slice(jsonStart).trim();
  const jsonEnd = jsonText.lastIndexOf("}");
  if (jsonEnd === -1) {
    throw new Error("Workflow JSON end not found");
  }
  return JSON.parse(jsonText.slice(0, jsonEnd + 1)) as WorkflowResult;
};

export const runWorkflow = async (payload: object, opts?: { broadcast?: boolean }) => {
  const projectRoot = path.resolve(process.cwd(), "..");
  const workflowPath = path.join(projectRoot, "creon-workflow");

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "creon-x402-"));
  const payloadPath = path.join(tempDir, "payload.json");
  await writeFile(payloadPath, JSON.stringify(payload), "utf8");

  const args = [
    "workflow",
    "simulate",
    workflowPath,
    "--target=staging-settings",
    "--non-interactive",
    "--trigger-index=0",
    "--http-payload",
    `@${payloadPath}`,
  ];

  if (opts?.broadcast) {
    args.push("--broadcast");
  }

  return new Promise<WorkflowResult>((resolve, reject) => {
    const child = spawn("cre", args, {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`cre CLI failed: ${stderr || stdout}`));
        return;
      }
      try {
        const parsed = parseWorkflowResult(stdout);
        resolve(parsed);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
};
