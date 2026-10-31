import type { AnalysisResult, SimulationReport } from "@safetodelete/report-schema";
import type { DependencyGraph } from "@safetodelete/dependency-graph";
import { Gemma4Client } from "./client.js";

export class CleanupAdvisor {
  private client: Gemma4Client;

  constructor(client?: Gemma4Client) {
    this.client = client || new Gemma4Client();
  }

  public async adviseCleanup(context: {
    analysis: AnalysisResult;
    graph: DependencyGraph;
    targetPaths?: string[];
    report?: SimulationReport;
  }): Promise<string> {
    const orphans = context.analysis.nodes
      .filter((n) => n.kind === "file" && context.graph.isOrphan(n.id))
      .map((n) => n.id);

    let reportContext = "";
    if (context.report) {
      reportContext = `
SIMULATION FINDINGS FOR TARGETS (${context.report.targets.join(", ")}):
- Risk: ${context.report.riskCategory}
- Rationale: ${context.report.riskExplanation}
- Direct Dependants: ${context.report.dependantsFound.direct.join(", ") || "None"}
`;
    }

    const prompt = `
CLEANUP ADVICE REQUEST:
- Targets Considered: ${context.targetPaths?.join(", ") || "General repository cleanup"}
- Identified Orphan Files with 0 Incoming Static Imports (${orphans.length}):
${orphans.slice(0, 10).map((o) => `  * ${o}`).join("\n")}
${reportContext}

Recommend actionable, incremental cleanup steps:
1. Identify the safest files to delete first (leaf nodes or verified orphans).
2. For modules with active dependants, suggest incremental refactoring or deprecation strategies.
3. Recommend how to safely verify each step.
`.trim();

    const systemInstruction =
      "You are the SafeToDelete Cleanup Advisor powered by Gemma 4. " +
      "Provide practical, risk-minimizing refactoring strategies for removing legacy code safely in small, verifiable increments.";

    const res = await this.client.generateText(prompt, systemInstruction);
    return res.content;
  }
}

