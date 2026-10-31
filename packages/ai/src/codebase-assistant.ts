import type { AnalysisResult } from "@safetodelete/report-schema";
import type { DependencyGraph } from "@safetodelete/dependency-graph";
import { Gemma4Client } from "./client.js";

export class CodebaseAssistant {
  private client: Gemma4Client;

  constructor(client?: Gemma4Client) {
    this.client = client || new Gemma4Client();
  }

  public async askQuestion(
    question: string,
    context: {
      analysis: AnalysisResult;
      graph: DependencyGraph;
      focusPath?: string;
    }
  ): Promise<string> {
    const totalNodes = context.analysis.nodes.length;
    const totalEdges = context.analysis.edges.length;
    const orphans = context.analysis.nodes
      .filter((n) => n.kind === "file" && context.graph.isOrphan(n.id))
      .map((n) => n.id);

    let focusDetails = "";
    if (context.focusPath) {
      const incoming = context.graph.getIncomingEdges(context.focusPath);
      const outgoing = context.graph.getOutgoingEdges(context.focusPath);
      const impact = context.graph.getImpactSummary([context.focusPath]);

      focusDetails = `
FOCUS MODULE: "${context.focusPath}"
- Direct Importers (${incoming.length}): ${incoming.map((e) => e.from).join(", ") || "None"}
- Outgoing Dependencies (${outgoing.length}): ${outgoing.map((e) => e.to).join(", ") || "None"}
- Downstream Transitive Impact: ${impact.transitive.join(", ") || "None"}
`;
    }

    const prompt = `
CODEBASE CONTEXT:
- Repository: ${context.analysis.repository.rootPath}
- Total Modules: ${totalNodes}
- Total Dependency Edges: ${totalEdges}
- Orphan Modules (0 incoming static references) [${orphans.length}]: ${orphans.slice(0, 15).join(", ")}${orphans.length > 15 ? "..." : ""}
${focusDetails}

DEVELOPER QUESTION:
"${question}"

Provide a direct, accurate answer using the dependency graph data. Cite specific files, incoming references, and explain any potential deletion impact.
`.trim();

    const systemInstruction =
      "You are the SafeToDelete Codebase Assistant powered by Gemma 4. " +
      "Help software engineers explore codebase dependencies, module coupling, and deletion safety. " +
      "Base your answers strictly on the supplied dependency graph data.";

    const res = await this.client.generateText(prompt, systemInstruction);
    return res.content;
  }
}

