import type { SimulationReport } from "@safetodelete/report-schema";
import { Gemma4Client } from "./client.js";

export class ImpactSummarizer {
  private client: Gemma4Client;

  constructor(client?: Gemma4Client) {
    this.client = client || new Gemma4Client();
  }

  public async summarizeImpact(report: SimulationReport): Promise<string> {
    const prompt = `
SIMULATION IMPACT ASSESSMENT:
- Proposed Targets: ${report.targets.join(", ")}
- Risk Classification: ${report.riskCategory} (${report.riskExplanation})
- Direct Dependants Count: ${report.dependantsFound.direct.length}
- Direct Dependants List: ${report.dependantsFound.direct.join(", ") || "None"}
- Transitive Dependants Count: ${report.dependantsFound.transitive.length}
- Transitive Dependants List: ${report.dependantsFound.transitive.join(", ") || "None"}
- Failed Checks: ${report.checks.filter((c) => c.status === "FAILED").map((c) => c.label).join(", ") || "None"}
- Key Findings: ${report.findings.map((f) => f.message).join("; ") || "None"}

Generate an Impact Summary formatted for a GitHub Pull Request description:
- **Summary**: High-level blast radius.
- **Affected Components**: Modules, routes, or services directly impacted.
- **Transitive Impact**: Downstream effects.
- **Pre-Merge Recommendation**: Actionable decision for code reviewers.
`.trim();

    const systemInstruction =
      "You are the SafeToDelete Impact Summarizer powered by Gemma 4. " +
      "Produce a concise, professional markdown impact summary for pull request reviews and team discussions.";

    const res = await this.client.generateText(prompt, systemInstruction);
    return res.content;
  }
}

