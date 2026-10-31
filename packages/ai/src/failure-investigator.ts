import type { SimulationReport } from "@safetodelete/report-schema";
import { Gemma4Client } from "./client.js";

export class FailureInvestigator {
  private client: Gemma4Client;

  constructor(client?: Gemma4Client) {
    this.client = client || new Gemma4Client();
  }

  public async investigateFailures(report: SimulationReport): Promise<string> {
    const failedChecks = report.checks.filter((c) => c.status === "FAILED" || c.status === "ERROR");

    if (failedChecks.length === 0) {
      return "No verification checks failed in this simulation. All executed commands completed successfully.";
    }

    const failedLogs = failedChecks
      .map(
        (c) => `
CHECK: ${c.label} (Exit Code: ${c.exitCode})
LOG SUMMARY:
${c.logSummary || "No log details available"}
`
      )
      .join("\n");

    const prompt = `
FAILED CHECKS AFTER SIMULATED DELETION:
- Target(s) Deleted in Simulation: ${report.targets.join(", ")}
- Remaining Static Dependants: ${report.dependantsFound.direct.join(", ") || "None found"}
- Failed Check Details:
${failedLogs}

Investigate the failure:
1. Identify the exact root cause from the error log and stack trace.
2. Which deleted symbol, file, or export triggered the breakage?
3. How can the developer resolve this dependency before deleting?
`.trim();

    const systemInstruction =
      "You are the SafeToDelete Failure Investigator powered by Gemma 4. " +
      "Analyze build logs and test errors from simulated deletions, trace root causes, and explain how to resolve them.";

    const res = await this.client.generateText(prompt, systemInstruction);
    return res.content;
  }
}

