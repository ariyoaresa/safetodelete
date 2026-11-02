import fs from "node:fs";
import path from "node:path";
import { Analyzer } from "@safetodelete/analyzer";
import { WorktreeManager } from "@safetodelete/simulator";
import { SandboxRunner } from "@safetodelete/runner";
import { RiskEvaluator } from "@safetodelete/risk-engine";
import type { SimulationReport, CheckResult } from "@safetodelete/report-schema";
import { toRepoRelativePath } from "@safetodelete/shared";

export interface SimulationExecutionOptions {
  repoRoot: string;
  targets: string[];
  allowDirty?: boolean;
  baseSha?: string;
  checkCommands?: string[];
  timeoutMs?: number;
  allowHostExec?: boolean;
}

export async function executeSimulation(options: SimulationExecutionOptions): Promise<SimulationReport> {
  const repoRoot = path.resolve(options.repoRoot);

  // 1. Static baseline analysis
  const analyzer = new Analyzer({
    repoRoot,
    commitSha: options.baseSha,
  });
  const { result: analysisResult, graph } = analyzer.analyze();

  // Normalize targets to repo-relative paths
  const relTargets = options.targets.map((t) => toRepoRelativePath(repoRoot, t));

  // Verify targets exist
  for (const t of relTargets) {
    const full = path.join(repoRoot, t);
    if (!fs.existsSync(full)) {
      throw new Error(`Target file or directory "${t}" does not exist in repository.`);
    }
  }

  // 2. Setup Worktree & Deletion
  const worktreeManager = new WorktreeManager({
    repoRoot,
    baseSha: options.baseSha || analysisResult.repository.commitSha,
    allowDirty: options.allowDirty,
  });

  const handle = worktreeManager.createWorktree();
  const checks: CheckResult[] = [];

  if (!handle.nodeModulesLinked && fs.existsSync(path.join(repoRoot, "node_modules"))) {
    analysisResult.diagnostics.push({
      code: "DEPENDENCY_LINK_WARNING",
      message:
        "Failed to link node_modules into isolated simulation worktree. Verification checks may fail if external dependencies are required.",
      file: "package.json",
      severity: "WARNING",
    });
  }

  try {
    // Apply deletion inside isolated worktree
    handle.applyDeletion(relTargets);

    // 3. Determine verification commands
    const commandsToRun: string[] = [];
    if (options.checkCommands && options.checkCommands.length > 0) {
      commandsToRun.push(...options.checkCommands);
    } else {
      // Auto-detect scripts in package.json
      const pkgPath = path.join(handle.worktreePath, "package.json");
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          if (pkg.scripts?.test) {
            commandsToRun.push("npm test");
          }
          if (pkg.scripts?.build) {
            commandsToRun.push("npm run build");
          }
        } catch {
          // Ignore
        }
      }
    }

    // 4. Run Sandbox Checks
    const runner = new SandboxRunner({
      defaultTimeoutMs: options.timeoutMs ?? 60_000,
      allowHostExecution: options.allowHostExec ?? true,
    });

    for (const cmd of commandsToRun) {
      const checkRes = await runner.executeCheck({
        label: cmd,
        command: cmd,
        cwd: handle.worktreePath,
      });
      checks.push(checkRes);
    }
  } finally {
    // 5. Guaranteed cleanup of isolated worktree
    handle.cleanup();
  }

  // 6. Evaluate Risk
  const evaluator = new RiskEvaluator();
  const report = evaluator.evaluate({
    repository: analysisResult.repository,
    targets: relTargets,
    graph,
    diagnostics: analysisResult.diagnostics,
    checks,
  });

  return report;
}
