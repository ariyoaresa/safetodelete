#!/usr/bin/env node
import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import { Analyzer } from "@safetodelete/analyzer";
import { executeSimulation } from "./engine.js";
import { formatTerminalReport } from "./formatter.js";

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
  .option("--check <commands...>", "Custom verification command(s) to execute in sandbox")
  .option("--timeout <ms>", "Timeout in milliseconds for each check", "60000")
  .option("--json", "Output report as JSON")
  .option("-o, --out <file>", "Save report to a JSON file")
  .action(async (targets: string[], opts: { repo: string; allowDirty?: boolean; check?: string[]; timeout: string; json?: boolean; out?: string }) => {
    try {
      const repoPath = path.resolve(opts.repo);
      const timeoutMs = parseInt(opts.timeout, 10);

      const report = await executeSimulation({
        repoRoot: repoPath,
        targets,
        allowDirty: opts.allowDirty,
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

program.parse(process.argv);

