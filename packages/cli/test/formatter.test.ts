import { describe, it, expect } from "vitest";
import { formatTerminalReport } from "../src/formatter.js";
import type { SimulationReport } from "@safetodelete/report-schema";

describe("Terminal Formatter", () => {
  const dummyReport: SimulationReport = {
    id: "report-abc123",
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    repository: {
      rootPath: "/test/repo",
      commitSha: "sha123",
      detectedLanguages: ["TypeScript"],
      packageManager: "npm",
    },
    targets: ["src/utils/math.ts"],
    riskCategory: "HIGH",
    riskExplanation: "Active static dependants remain",
    findings: [
      {
        id: "finding-1",
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
        durationMs: 400,
        logSummary: "> test-pkg@1.0.0 test\n\nFAIL src/math.test.ts\nError: Cannot find module './math.js'",
      },
    ],
    dependantsFound: {
      direct: ["src/consumer.ts"],
      transitive: [],
    },
    limitations: ["Static analysis cannot prove absence of reflection"],
  };

  it("formats terminal report and extracts meaningful failure summary instead of command header", () => {
    const formatted = formatTerminalReport(dummyReport);

    expect(formatted).toContain("SAFETODELETE REPORT");
    expect(formatted).toContain("RISK CATEGORY: [ HIGH ]");
    expect(formatted).toContain("src/consumer.ts");
    expect(formatted).toContain("[FAILED] npm test");
    // Verify it doesn't just show the first line "> test-pkg@1.0.0 test"
    expect(formatted).toContain("Cannot find module './math.js'");
  });
});

