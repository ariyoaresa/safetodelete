import type { SimulationReport } from "@safetodelete/report-schema";

export function formatTerminalReport(report: SimulationReport): string {
  const divider = "=".repeat(60);
  const subDivider = "-".repeat(60);

  const lines: string[] = [
    divider,
    `  SAFETODELETE REPORT — PRE-MERGE RISK ASSESSMENT`,
    divider,
    `Report ID   : ${report.id}`,
    `Repository  : ${report.repository.rootPath}`,
    `Commit SHA  : ${report.repository.commitSha} ${report.repository.isDirty ? "(DIRTY)" : "(CLEAN)"}`,
    `Languages   : ${report.repository.detectedLanguages.join(", ") || "Unknown"}`,
    `Pkg Manager : ${report.repository.packageManager || "Unknown"}`,
    `Targets     : ${report.targets.join(", ")}`,
    subDivider,
    `RISK CATEGORY: [ ${report.riskCategory} ]`,
    `RATIONALE    : ${report.riskExplanation}`,
    subDivider,
    `STATIC IMPACT:`,
    `  Direct dependants    : ${report.dependantsFound.direct.length}`,
    ...report.dependantsFound.direct.map((d) => `    -> ${d}`),
    `  Transitive dependants: ${report.dependantsFound.transitive.length}`,
    ...report.dependantsFound.transitive.map((t) => `    -> ${t}`),
    subDivider,
    `VERIFICATION CHECKS:`,
  ];

  if (report.checks.length === 0) {
    lines.push("  (No verification commands executed)");
  } else {
    for (const check of report.checks) {
      lines.push(
        `  [${check.status}] ${check.label} (code: ${check.exitCode ?? 0}, ${check.durationMs}ms)`
      );
      if (check.status !== "PASSED" && check.logSummary) {
        lines.push(`    Summary: ${check.logSummary.split("\n")[0]}`);
      }
    }
  }

  lines.push(subDivider);
  lines.push(`FINDINGS (${report.findings.length}):`);
  if (report.findings.length === 0) {
    lines.push("  No negative findings or regressions identified.");
  } else {
    for (const finding of report.findings) {
      lines.push(
        `  [${finding.severity}] [${finding.confidenceLabel}] ${finding.message}`
      );
    }
  }

  lines.push(subDivider);
  lines.push("DISCLAIMERS & LIMITATIONS:");
  for (const lim of report.limitations) {
    lines.push(`  * ${lim}`);
  }
  lines.push(divider);

  return lines.join("\n");
}

