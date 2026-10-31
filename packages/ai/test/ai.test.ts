import { describe, it, expect } from "vitest";
import {
  Gemma4Client,
  RiskExplainer,
  CodebaseAssistant,
  CleanupAdvisor,
  FailureInvestigator,
  ImpactSummarizer,
} from "../src/index.js";
import { DependencyGraph } from "@safetodelete/dependency-graph";
import type { SimulationReport, AnalysisResult } from "@safetodelete/report-schema";

describe("SafeToDelete AI Layer (Gemma 4)", () => {
  const dummyReport: SimulationReport = {
    id: "report-123",
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    repository: {
      rootPath: "/test/repo",
      commitSha: "abc1234",
      detectedLanguages: ["TypeScript"],
    },
    targets: ["src/utils/math.ts"],
    riskCategory: "HIGH",
    riskExplanation: "2 active static dependants remain and test failed",
    findings: [
      {
        id: "f-1",
        severity: "ERROR",
        category: "STATIC_DEPENDENCY",
        message: "Active dependants remain",
        evidence: [],
        confidenceLabel: "CONFIRMED",
      },
    ],
    checks: [
      {
        label: "npm test",
        command: "npm test",
        status: "FAILED",
        exitCode: 1,
        durationMs: 450,
        logSummary: "Cannot find module './math.js' imported from src/consumer.ts",
      },
    ],
    dependantsFound: {
      direct: ["src/consumer.ts"],
      transitive: ["src/app.ts"],
    },
    limitations: ["Static analysis cannot prove absence of reflection"],
  };

  const dummyAnalysis: AnalysisResult = {
    id: "analysis-1",
    repository: dummyReport.repository,
    nodes: [
      { id: "src/orphan.ts", path: "src/orphan.ts", kind: "file" },
      { id: "src/consumer.ts", path: "src/consumer.ts", kind: "file" },
      { id: "src/utils/math.ts", path: "src/utils/math.ts", kind: "file" },
    ],
    edges: [
      {
        from: "src/consumer.ts",
        to: "src/utils/math.ts",
        kind: "imports",
        evidence: { file: "src/consumer.ts", line: 1 },
      },
    ],
    diagnostics: [],
    createdAt: new Date().toISOString(),
  };

  const graph = new DependencyGraph();
  for (const n of dummyAnalysis.nodes) graph.addNode(n);
  for (const e of dummyAnalysis.edges) graph.addEdge(e);

  it("Gemma4Client defaults to Gemma 4 model", () => {
    const client = new Gemma4Client();
    expect(client.getModelName()).toContain("gemma-4");
  });

  it("RiskExplainer explains simulation results", async () => {
    const explainer = new RiskExplainer();
    const result = await explainer.explainReport(dummyReport);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(20);
    expect(result).toContain("Gemma 4");
  });

  it("CodebaseAssistant answers developer questions about dependency graph", async () => {
    const assistant = new CodebaseAssistant();
    const answer = await assistant.askQuestion("What depends on math.ts?", {
      analysis: dummyAnalysis,
      graph,
      focusPath: "src/utils/math.ts",
    });
    expect(answer).toBeDefined();
    expect(answer.length).toBeGreaterThan(20);
  });

  it("CleanupAdvisor recommends safe, incremental cleanup steps", async () => {
    const advisor = new CleanupAdvisor();
    const advice = await advisor.adviseCleanup({
      analysis: dummyAnalysis,
      graph,
      report: dummyReport,
    });
    expect(advice).toBeDefined();
    expect(advice).toContain("Cleanup");
  });

  it("FailureInvestigator analyzes and diagnoses test failure logs", async () => {
    const investigator = new FailureInvestigator();
    const diagnosis = await investigator.investigateFailures(dummyReport);
    expect(diagnosis).toBeDefined();
    expect(diagnosis).toContain("Failure");
  });

  it("ImpactSummarizer generates concise overview for pull request reviews", async () => {
    const summarizer = new ImpactSummarizer();
    const summary = await summarizer.summarizeImpact(dummyReport);
    expect(summary).toBeDefined();
    expect(summary).toContain("Impact");
  });
});

