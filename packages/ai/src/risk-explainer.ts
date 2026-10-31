import type { SimulationReport } from "@safetodelete/report-schema";
import { Gemma4Client } from "./client.js";

export class RiskExplainer {
  private client: Gemma4Client;

  constructor(client?: Gemma4Client) {
    this.client = client || new Gemma4Client();
  }

  public async explainReport(report: SimulationReport): Promise<string> {
    const prompt = `
SIMULATION REPORT:
- Repository: ${report.repository.rootPath} (Commit: ${report.repository.commitSha})
- Targets: ${report.targets.join(", ")}
- Risk Category: ${report.riskCategory}
- Rationale: ${report.riskExplanation}
- Direct Dependants (${report.dependantsFound.direct.length}): ${report.dependantsFound.direct.join(", ") || "None"}
- Transitive Dependants (${report.dependantsFound.transitive.length}): ${report.dependantsFound.transitive.join(", ") || "None"}
- Verification Checks:
${report.checks.map((c) => `  * [${c.status}] ${c.label} (Exit Code: ${c.exitCode ?? 0})`).join("\n")}
- Findings:
${report.findings.map((f) => `  * [${f.severity}] ${f.message}`).join("\n")}
- Limitations Disclosed:
${report.limitations.map((l) => `  * ${l}`).join("\n")}

Please explain this risk report in clear, concise technical language for software engineers:
1. What does this risk category mean for this specific deletion?
2. What broke or what remained safe?
3. What uncertainty or limitations must the engineer keep in mind?
`.trim();

    const systemInstruction =
      "You are the SafeToDelete AI Risk Explainer powered by Gemma 4. " +
      "Explain the pre-merge deletion simulation report clearly and objectively based ONLY on the evidence provided. " +
      "Never claim a deletion is 100% safe if uncertainty or missing tests exist. Never hallucinate evidence.";

    const res = await this.client.generateText(prompt, systemInstruction);
    return res.content;
  }
}

