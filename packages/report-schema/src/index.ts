/**
 * Core risk categories representing evidence-based uncertainty.
 */
export type RiskCategory = "LOW" | "MEDIUM" | "HIGH" | "INCONCLUSIVE";

export type FindingSeverity = "INFO" | "WARNING" | "ERROR";

export type CheckStatus = "PASSED" | "FAILED" | "SKIPPED" | "TIMED_OUT" | "ERROR";

export type ConfidenceLabel = "CONFIRMED" | "OBSERVED" | "STATIC" | "POSSIBLE";

export type FindingCategory =
  | "STATIC_DEPENDENCY"
  | "DYNAMIC_IMPORT"
  | "TEST_FAILURE"
  | "BUILD_FAILURE"
  | "MISSING_TESTS"
  | "UNRESOLVED_REFERENCE"
  | "CONFIG_REFERENCE"
  | "SECURITY_VIOLATION";

export interface RepositorySnapshot {
  rootPath: string;
  commitSha: string;
  detectedLanguages: string[];
  packageManager?: string;
  isDirty?: boolean;
}

export type AnalysisNodeKind = "file" | "package" | "symbol" | "route" | "config";

export interface AnalysisNode {
  id: string; // repo-relative normalized path or symbol ID
  path: string;
  kind: AnalysisNodeKind;
  metadata?: Record<string, unknown>;
}

export type AnalysisEdgeKind =
  | "imports"
  | "reexports"
  | "dynamic-import"
  | "config-reference"
  | "package-dependency";

export interface AnalysisEdge {
  from: string; // Source Node ID
  to: string;   // Target Node ID
  kind: AnalysisEdgeKind;
  evidence: {
    file: string;
    line?: number;
    column?: number;
    rawSpecifier?: string;
  };
}

export interface Diagnostic {
  code: string;
  message: string;
  file: string;
  line?: number;
  column?: number;
  severity: FindingSeverity;
}

export interface CheckResult {
  label: string;
  command: string;
  status: CheckStatus;
  exitCode?: number;
  durationMs: number;
  logSummary?: string;
  logReference?: string;
}

export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  message: string;
  evidence: unknown[];
  confidenceLabel: ConfidenceLabel;
}

export interface DependantsSummary {
  direct: string[];
  transitive: string[];
}

export interface AnalysisResult {
  id: string;
  repository: RepositorySnapshot;
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
  diagnostics: Diagnostic[];
  createdAt: string;
}

export interface SimulationReport {
  id: string;
  version: "1.0.0";
  createdAt: string;
  repository: RepositorySnapshot;
  targets: string[];
  riskCategory: RiskCategory;
  riskExplanation: string;
  findings: Finding[];
  checks: CheckResult[];
  dependantsFound: DependantsSummary;
  limitations: string[];
}

