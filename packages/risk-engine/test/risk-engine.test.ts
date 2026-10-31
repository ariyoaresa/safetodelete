import { describe, it, expect } from "vitest";
import { RiskEvaluator } from "../src/evaluator.js";
import { DependencyGraph } from "@safetodelete/dependency-graph";
import type { RepositorySnapshot } from "@safetodelete/report-schema";

describe("RiskEvaluator", () => {
  const dummyRepo: RepositorySnapshot = {
    rootPath: "/test/repo",
    commitSha: "abc1234",
    detectedLanguages: ["TypeScript"],
  };

  it("classifies risk as HIGH when static dependants remain", () => {
    const graph = new DependencyGraph();
    graph.addEdge({
      from: "src/app.ts",
      to: "src/utils.ts",
      kind: "imports",
      evidence: { file: "src/app.ts", line: 1 },
    });

    const evaluator = new RiskEvaluator();
    const report = evaluator.evaluate({
      repository: dummyRepo,
      targets: ["src/utils.ts"],
      graph,
      diagnostics: [],
      checks: [
        {
          label: "npm test",
          command: "npm test",
          status: "PASSED",
          durationMs: 500,
        },
      ],
    });

    expect(report.riskCategory).toBe("HIGH");
    expect(report.findings.some((f) => f.category === "STATIC_DEPENDENCY")).toBe(true);
  });

  it("classifies risk as HIGH when verification checks fail", () => {
    const graph = new DependencyGraph();
    graph.addNode({ id: "src/orphan.ts", path: "src/orphan.ts", kind: "file" });

    const evaluator = new RiskEvaluator();
    const report = evaluator.evaluate({
      repository: dummyRepo,
      targets: ["src/orphan.ts"],
      graph,
      diagnostics: [],
      checks: [
        {
          label: "npm test",
          command: "npm test",
          status: "FAILED",
          exitCode: 1,
          durationMs: 300,
        },
      ],
    });

    expect(report.riskCategory).toBe("HIGH");
    expect(report.findings.some((f) => f.category === "TEST_FAILURE")).toBe(true);
  });

  it("classifies risk as MEDIUM when tests are missing", () => {
    const graph = new DependencyGraph();
    graph.addNode({ id: "src/orphan.ts", path: "src/orphan.ts", kind: "file" });

    const evaluator = new RiskEvaluator();
    const report = evaluator.evaluate({
      repository: dummyRepo,
      targets: ["src/orphan.ts"],
      graph,
      diagnostics: [],
      checks: [], // No checks run
    });

    expect(report.riskCategory).toBe("MEDIUM");
    expect(report.findings.some((f) => f.category === "MISSING_TESTS")).toBe(true);
  });

  it("classifies risk as LOW when zero dependants and checks pass", () => {
    const graph = new DependencyGraph();
    graph.addNode({ id: "src/orphan.ts", path: "src/orphan.ts", kind: "file" });

    const evaluator = new RiskEvaluator();
    const report = evaluator.evaluate({
      repository: dummyRepo,
      targets: ["src/orphan.ts"],
      graph,
      diagnostics: [],
      checks: [
        {
          label: "npm test",
          command: "npm test",
          status: "PASSED",
          durationMs: 200,
        },
      ],
    });

    expect(report.riskCategory).toBe("LOW");
    expect(report.limitations.length).toBeGreaterThan(0);
  });

  it("classifies risk as INCONCLUSIVE when check times out or errors", () => {
    const graph = new DependencyGraph();
    graph.addNode({ id: "src/orphan.ts", path: "src/orphan.ts", kind: "file" });

    const evaluator = new RiskEvaluator();
    const report = evaluator.evaluate({
      repository: dummyRepo,
      targets: ["src/orphan.ts"],
      graph,
      diagnostics: [],
      checks: [
        {
          label: "npm test",
          command: "npm test",
          status: "TIMED_OUT",
          durationMs: 60000,
        },
      ],
    });

    expect(report.riskCategory).toBe("INCONCLUSIVE");
  });
});

