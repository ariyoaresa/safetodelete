import type {
  CheckResult,
  Diagnostic,
  Finding,
  RiskCategory,
  SimulationReport,
  RepositorySnapshot,
} from "@safetodelete/report-schema";
import type { DependencyGraph } from "@safetodelete/dependency-graph";

export interface EvaluationInput {
  repository: RepositorySnapshot;
  targets: string[];
  graph: DependencyGraph;
  diagnostics: Diagnostic[];
  checks: CheckResult[];
}

export class RiskEvaluator {
  public evaluate(input: EvaluationInput): SimulationReport {
    const findings: Finding[] = [];
    const limitations: string[] = [
      "Static analysis cannot prove absence of unobserved runtime dependencies, reflection, or dynamic path resolution.",
      "Verification checks only validate the assertions implemented in your project test/build scripts.",
      "A LOW risk classification indicates no detected breakage by configured checks, not an absolute guarantee.",
    ];

    const impact = input.graph.getImpactSummary(input.targets);

    // 1. Evaluate Direct Static Dependants
    if (impact.direct.length > 0) {
      findings.push({
        id: `finding-static-${Date.now()}`,
        severity: "ERROR",
        category: "STATIC_DEPENDENCY",
        message: `Deletion candidate has ${impact.direct.length} active static dependant(s) in the codebase.`,
        evidence: impact.direct,
        confidenceLabel: "CONFIRMED",
      });
    }

    // 2. Evaluate Config References
    for (const target of input.targets) {
      const incoming = input.graph.getIncomingEdges(target);
      const configRefs = incoming.filter((e) => e.kind === "config-reference");
      if (configRefs.length > 0) {
        findings.push({
          id: `finding-config-${Date.now()}-${target}`,
          severity: "ERROR",
          category: "CONFIG_REFERENCE",
          message: `Target "${target}" is referenced by project configuration (${configRefs.map((e) => e.from).join(", ")}).`,
          evidence: configRefs,
          confidenceLabel: "CONFIRMED",
        });
      }
    }

    // 3. Evaluate Verification Checks
    let hasFailedCheck = false;
    let hasTimeoutOrError = false;
    let hasPassedCheck = false;

    for (const check of input.checks) {
      if (check.status === "FAILED") {
        hasFailedCheck = true;
        findings.push({
          id: `finding-check-failed-${check.label}`,
          severity: "ERROR",
          category: check.label.toLowerCase().includes("build") ? "BUILD_FAILURE" : "TEST_FAILURE",
          message: `Check "${check.label}" failed after deletion simulation with exit code ${check.exitCode ?? 1}.`,
          evidence: [check.logSummary || "No log summary available"],
          confidenceLabel: "OBSERVED",
        });
      } else if (check.status === "TIMED_OUT" || check.status === "ERROR") {
        hasTimeoutOrError = true;
        findings.push({
          id: `finding-check-error-${check.label}`,
          severity: "WARNING",
          category: "TEST_FAILURE",
          message: `Check "${check.label}" encountered an execution error or timed out.`,
          evidence: [check.logSummary || "Execution interrupted"],
          confidenceLabel: "OBSERVED",
        });
      } else if (check.status === "PASSED") {
        hasPassedCheck = true;
      }
    }

    if (input.checks.length === 0) {
      findings.push({
        id: `finding-missing-tests-${Date.now()}`,
        severity: "WARNING",
        category: "MISSING_TESTS",
        message: "No verification commands (tests or build) were configured or executed.",
        evidence: [],
        confidenceLabel: "OBSERVED",
      });
    }

    // 4. Evaluate Diagnostics (unresolved imports and non-literal dynamic imports)
    const unresolvedDiags = input.diagnostics.filter(
      (d) => d.code === "UNRESOLVED_IMPORT"
    );
    if (unresolvedDiags.length > 0) {
      findings.push({
        id: `finding-unresolved-${Date.now()}`,
        severity: "WARNING",
        category: "UNRESOLVED_REFERENCE",
        message: `Detected ${unresolvedDiags.length} unresolved import(s) in analyzed codebase.`,
        evidence: unresolvedDiags.map((d) => `${d.file}:${d.line ?? 0} - ${d.message}`),
        confidenceLabel: "POSSIBLE",
      });
    }

    const dynamicDiags = input.diagnostics.filter(
      (d) => d.code === "DYNAMIC_NON_LITERAL_IMPORT"
    );
    if (dynamicDiags.length > 0) {
      findings.push({
        id: `finding-dynamic-${Date.now()}`,
        severity: "WARNING",
        category: "DYNAMIC_IMPORT",
        message: `Detected ${dynamicDiags.length} non-literal dynamic import(s) that cannot be statically mapped.`,
        evidence: dynamicDiags.map((d) => `${d.file}:${d.line}`),
        confidenceLabel: "POSSIBLE",
      });
    }

    // 5. Determine Deterministic Risk Category
    let riskCategory: RiskCategory;
    let riskExplanation: string;

    if (hasTimeoutOrError) {
      riskCategory = "INCONCLUSIVE";
      riskExplanation =
        "The simulation could not conclusively verify safety because one or more checks timed out or failed to execute.";
    } else if (hasFailedCheck || impact.direct.length > 0) {
      riskCategory = "HIGH";
      const reasons: string[] = [];
      if (impact.direct.length > 0) reasons.push(`${impact.direct.length} active static dependant(s) remain`);
      if (hasFailedCheck) reasons.push("verification test/build failed after removal");
      riskExplanation = `High risk of regression: ${reasons.join(" and ")}.`;
    } else if (dynamicDiags.length > 0 || unresolvedDiags.length > 0 || input.checks.length === 0) {
      riskCategory = "MEDIUM";
      const reasons: string[] = [];
      if (input.checks.length === 0) reasons.push("no automated verification tests were executed");
      if (dynamicDiags.length > 0) reasons.push("unresolved dynamic imports exist in the codebase");
      if (unresolvedDiags.length > 0) reasons.push("unresolved import specifiers exist in the codebase");
      riskExplanation = `Medium risk / uncertainty: ${reasons.join(", ")}.`;
    } else if (hasPassedCheck && impact.direct.length === 0) {
      riskCategory = "LOW";
      riskExplanation =
        "Low risk: Zero static dependants detected and all configured verification checks passed in isolated simulation.";
    } else {
      riskCategory = "MEDIUM";
      riskExplanation = "Medium risk: Incomplete evidence available to classify as low risk.";
    }

    return {
      id: `report-${Date.now()}`,
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      repository: input.repository,
      targets: input.targets,
      riskCategory,
      riskExplanation,
      findings,
      checks: input.checks,
      dependantsFound: impact,
      limitations,
    };
  }
}
