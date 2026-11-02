#!/usr/bin/env node
import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import { Analyzer } from "@safetodelete/analyzer";
import {
  RiskExplainer,
  CodebaseAssistant,
  CleanupAdvisor,
  FailureInvestigator,
  ImpactSummarizer,
} from "@safetodelete/ai";
import { executeSimulation } from "./engine.js";
import { formatTerminalReport } from "./formatter.js";

// Automatically load .env file if available in the current environment
if (typeof (process as any).loadEnvFile === "function") {
  try {
    (process as any).loadEnvFile();
  } catch {
    // .env file is optional
  }
}

const program = new Command();

program
  .name("safetodelete")
  .description("Know what breaks before you delete it — Evidence-based deletion simulation")
  .version("1.0.0");

program
  .command("analyze")
  .description("Analyze repository dependencies and list candidates")
  .option("-r, --repo <path>", "Path to Git repository", ".")
  .option("--json", "Output raw JSON analysis")
  .action((opts: { repo: string; json?: boolean }) => {
    try {
      const repoPath = path.resolve(opts.repo);
      const analyzer = new Analyzer({ repoRoot: repoPath });
      const { result, graph } = analyzer.analyze();

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`\nRepository: ${repoPath}`);
      console.log(`Commit SHA: ${result.repository.commitSha} (${result.repository.isDirty ? "DIRTY" : "CLEAN"})`);
      console.log(`Discovered Files: ${result.nodes.length}`);
      console.log(`Direct Dependencies/Edges: ${result.edges.length}`);
      console.log(`Diagnostics: ${result.diagnostics.length}\n`);

      const orphans = result.nodes
        .filter((n: { id: string; kind: string }) => n.kind === "file" && graph.isOrphan(n.id))
        .map((n: { id: string }) => n.id);

      console.log(`Deletion Candidates (Files with 0 incoming static references) [${orphans.length}]:`);
      for (const orphan of orphans) {
        console.log(`  * ${orphan}`);
      }
      console.log();
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("simulate")
  .description("Simulate isolated deletion of specified file(s) or folder(s)")
  .argument("<targets...>", "Relative path(s) of files or folders to test deleting")
  .option("-r, --repo <path>", "Path to Git repository", ".")
  .option("--allow-dirty", "Allow running against committed HEAD even if working tree is dirty", false)
  .option("--allow-host-exec", "Permit executing verification checks on host machine", true)
  .option("--check <commands...>", "Custom verification command(s) to execute in sandbox")
  .option("--timeout <ms>", "Timeout in milliseconds for each check", "60000")
  .option("--ai", "Generate AI explanation and impact summary powered by Gemma 4", false)
  .option("--json", "Output report as JSON")
  .option("-o, --out <file>", "Save report to a JSON file")
  .action(async (targets: string[], opts: { repo: string; allowDirty?: boolean; allowHostExec?: boolean; check?: string[]; timeout: string; json?: boolean; out?: string; ai?: boolean }) => {
    try {
      const repoPath = path.resolve(opts.repo);
      const rawTimeout = parseInt(opts.timeout, 10);
      const timeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 60_000;

      const report = await executeSimulation({
        repoRoot: repoPath,
        targets,
        allowDirty: opts.allowDirty,
        allowHostExec: opts.allowHostExec,
        checkCommands: opts.check,
        timeoutMs,
      });

      if (opts.out) {
        fs.writeFileSync(path.resolve(opts.out), JSON.stringify(report, null, 2));
        console.log(`Report written to ${opts.out}`);
      }

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatTerminalReport(report));

        if (opts.ai) {
          console.log("\n" + "=".repeat(60));
          console.log("  GEMMA 4 AI EXPLANATION & IMPACT ASSESSMENT");
          console.log("=".repeat(60));
          const explainer = new RiskExplainer();
          const explanation = await explainer.explainReport(report);
          console.log(explanation);
          console.log();

          const summarizer = new ImpactSummarizer();
          const summary = await summarizer.summarizeImpact(report);
          console.log(summary);
          console.log("=".repeat(60) + "\n");
        }
      }

      // Exit with non-zero code if risk is HIGH
      if (report.riskCategory === "HIGH") {
        process.exitCode = 2;
      }
    } catch (err) {
      console.error(`Simulation Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("ask <question>")
  .description("Ask Gemma 4 questions about codebase dependencies and deletion impact")
  .option("-r, --repo <path>", "Path to Git repository", ".")
  .option("-f, --focus <file>", "Focus on a specific target file")
  .action(async (question: string, opts: { repo: string; focus?: string }) => {
    try {
      const repoPath = path.resolve(opts.repo);
      const analyzer = new Analyzer({ repoRoot: repoPath });
      const { result, graph } = analyzer.analyze();

      const assistant = new CodebaseAssistant();
      console.log(`\nConsulting Gemma 4 on "${question}"...\n`);
      const answer = await assistant.askQuestion(question, {
        analysis: result,
        graph,
        focusPath: opts.focus,
      });
      console.log(answer + "\n");
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("advise [targets...]")
  .description("Get Gemma 4 cleanup and refactoring advice for safe, incremental deletions")
  .option("-r, --repo <path>", "Path to Git repository", ".")
  .action(async (targets: string[], opts: { repo: string }) => {
    try {
      const repoPath = path.resolve(opts.repo);
      const analyzer = new Analyzer({ repoRoot: repoPath });
      const { result, graph } = analyzer.analyze();

      const advisor = new CleanupAdvisor();
      console.log("\nGenerating Gemma 4 cleanup recommendations...\n");
      const advice = await advisor.adviseCleanup({
        analysis: result,
        graph,
        targetPaths: targets.length > 0 ? targets : undefined,
      });
      console.log(advice + "\n");
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("investigate <reportFile>")
  .description("Investigate check and test failures from a simulation report using Gemma 4")
  .action(async (reportFile: string) => {
    try {
      const filePath = path.resolve(reportFile);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Report file "${reportFile}" not found.`);
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      let report: any;
      try {
        report = JSON.parse(raw);
      } catch {
        throw new Error(`Report file "${reportFile}" contains invalid JSON.`);
      }

      if (!report || !report.repository || !report.riskCategory) {
        throw new Error(`Report file "${reportFile}" is not a valid SafeToDelete SimulationReport.`);
      }

      const investigator = new FailureInvestigator();
      console.log("\nInvestigating failure logs with Gemma 4...\n");
      const investigation = await investigator.investigateFailures(report);
      console.log(investigation + "\n");
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("explain <reportFile>")
  .description("Convert a saved simulation report into an AI technical explanation using Gemma 4")
  .action(async (reportFile: string) => {
    try {
      const filePath = path.resolve(reportFile);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Report file "${reportFile}" not found.`);
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      let report: any;
      try {
        report = JSON.parse(raw);
      } catch {
        throw new Error(`Report file "${reportFile}" contains invalid JSON.`);
      }

      if (!report || !report.repository || !report.riskCategory) {
        throw new Error(`Report file "${reportFile}" is not a valid SafeToDelete SimulationReport.`);
      }

      const explainer = new RiskExplainer();
      console.log("\nGenerating technical explanation with Gemma 4...\n");
      const explanation = await explainer.explainReport(report);
      console.log(explanation + "\n");
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
