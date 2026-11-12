import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import type {
  AnalysisResult,
  Diagnostic,
  RepositorySnapshot,
} from "@safetodelete/report-schema";
import { DependencyGraph } from "@safetodelete/dependency-graph";
import {
  parseJsTsReferences,
  ModuleResolver,
} from "@safetodelete/language-js-ts";
import { discoverRepositoryFiles, type DiscoverOptions } from "./file-discovery.js";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface AnalyzerOptions extends DiscoverOptions {
  repoRoot: string;
  commitSha?: string;
}

export function detectGitCommit(repoRoot: string): { commitSha: string; isDirty: boolean } {
  try {
    const sha = execSync("git rev-parse HEAD", {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf-8",
    }).trim();

    const status = execSync("git status --porcelain", {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf-8",
    }).trim();

    return {
      commitSha: sha,
      isDirty: status.length > 0,
    };
  } catch {
    return {
      commitSha: "UNKNOWN",
      isDirty: false,
    };
  }
}

function parsePackageManagerField(pkgJsonPath: string): PackageManager | undefined {
  if (!fs.existsSync(pkgJsonPath)) return undefined;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
    if (typeof pkg.packageManager === "string") {
      const name = pkg.packageManager.split("@")[0].trim().toLowerCase();
      if (name === "pnpm" || name === "yarn" || name === "bun" || name === "npm") {
        return name;
      }
    }
  } catch {
    // Ignore malformed package.json
  }
  return undefined;
}

function detectLockfileInDir(dir: string): PackageManager | undefined {
  if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(dir, "bun.lockb")) || fs.existsSync(path.join(dir, "bun.lock"))) {
    return "bun";
  }
  if (
    fs.existsSync(path.join(dir, "package-lock.json")) ||
    fs.existsSync(path.join(dir, "npm-shrinkwrap.json"))
  ) {
    return "npm";
  }
  return undefined;
}

export function detectPackageManager(repoRoot: string): PackageManager | undefined {
  let currentDir = path.resolve(repoRoot);

  while (true) {
    const fromField = parsePackageManagerField(path.join(currentDir, "package.json"));
    if (fromField) return fromField;

    const fromLock = detectLockfileInDir(currentDir);
    if (fromLock) return fromLock;

    if (fs.existsSync(path.join(currentDir, ".git"))) {
      break;
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  return undefined;
}

export function getPackageManagerScriptCommand(
  packageManager: string | undefined,
  scriptName: string
): string {
  const pm = (packageManager || "npm").toLowerCase();
  if (pm === "pnpm") {
    return scriptName === "test" ? "pnpm test" : `pnpm run ${scriptName}`;
  }
  if (pm === "yarn") {
    return scriptName === "test" ? "yarn test" : `yarn run ${scriptName}`;
  }
  if (pm === "bun") {
    return scriptName === "test" ? "bun test" : `bun run ${scriptName}`;
  }
  return scriptName === "test" ? "npm test" : `npm run ${scriptName}`;
}

export function resolveDefaultCheckCommands(
  worktreePath: string,
  detectedPackageManager?: string
): string[] {
  const commands: string[] = [];
  const pkgPath = path.join(worktreePath, "package.json");
  if (!fs.existsSync(pkgPath)) return commands;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const pm = detectedPackageManager || detectPackageManager(worktreePath) || "npm";

    if (pkg.scripts?.test) {
      commands.push(getPackageManagerScriptCommand(pm, "test"));
    }
    if (pkg.scripts?.build) {
      commands.push(getPackageManagerScriptCommand(pm, "build"));
    }
  } catch {
    // Ignore malformed package.json
  }

  return commands;
}

export class Analyzer {
  private repoRoot: string;
  private commitSha?: string;
  private discoverOptions: DiscoverOptions;

  constructor(options: AnalyzerOptions) {
    this.repoRoot = path.resolve(options.repoRoot);
    this.commitSha = options.commitSha;
    this.discoverOptions = {
      respectGitignore: options.respectGitignore,
      extraIgnorePatterns: options.extraIgnorePatterns,
    };
  }

  public analyze(): { result: AnalysisResult; graph: DependencyGraph } {
    const gitInfo = detectGitCommit(this.repoRoot);
    const commitSha = this.commitSha || gitInfo.commitSha;
    const packageManager = detectPackageManager(this.repoRoot);

    const { sourceFiles, configFiles } = discoverRepositoryFiles(
      this.repoRoot,
      this.discoverOptions
    );

    const detectedLanguages = new Set<string>();
    for (const f of sourceFiles) {
      if (f.endsWith(".ts") || f.endsWith(".tsx")) detectedLanguages.add("TypeScript");
      if (f.endsWith(".js") || f.endsWith(".jsx") || f.endsWith(".mjs") || f.endsWith(".cjs")) {
        detectedLanguages.add("JavaScript");
      }
    }

    const snapshot: RepositorySnapshot = {
      rootPath: this.repoRoot,
      commitSha,
      detectedLanguages: Array.from(detectedLanguages),
      packageManager,
      isDirty: gitInfo.isDirty,
    };

    const graph = new DependencyGraph();
    const diagnostics: Diagnostic[] = [];

    // Register all source files as nodes
    for (const file of sourceFiles) {
      graph.addNode({
        id: file,
        path: file,
        kind: "file",
      });
    }

    // Register config files
    for (const cfg of configFiles) {
      graph.addNode({
        id: cfg,
        path: cfg,
        kind: "config",
      });
    }

    // Initialize Resolver with tsconfig
    const tsconfig = ModuleResolver.loadTsConfig(this.repoRoot);
    const resolver = new ModuleResolver(this.repoRoot, tsconfig);

    // Parse all source files and code-based config files
    const allCodeFiles = [
      ...sourceFiles,
      ...configFiles.filter((c) =>
        c.endsWith(".ts") || c.endsWith(".js") || c.endsWith(".mjs") || c.endsWith(".cjs")
      ),
    ];

    for (const relFile of allCodeFiles) {
      const fullPath = path.join(this.repoRoot, relFile);
      let content = "";
      try {
        content = fs.readFileSync(fullPath, "utf-8");
      } catch {
        continue;
      }

      const refs = parseJsTsReferences(fullPath, content);

      for (const ref of refs) {
        if (!ref.isLiteral || !ref.rawSpecifier) {
          // Dynamic non-literal import
          diagnostics.push({
            code: "DYNAMIC_NON_LITERAL_IMPORT",
            message: `Dynamic non-literal import cannot be statically resolved.`,
            file: relFile,
            line: ref.line,
            column: ref.column,
            severity: "WARNING",
          });
          continue;
        }

        const resolved = resolver.resolve(fullPath, ref.rawSpecifier);

        if (resolved.type === "file" && resolved.resolvedPath) {
          graph.addEdge({
            from: relFile,
            to: resolved.resolvedPath,
            kind: ref.kind,
            evidence: {
              file: relFile,
              line: ref.line,
              column: ref.column,
              rawSpecifier: ref.rawSpecifier,
            },
          });
        } else if (resolved.type === "package" && resolved.packageName) {
          graph.addEdge({
            from: relFile,
            to: resolved.packageName,
            kind: "package-dependency",
            evidence: {
              file: relFile,
              line: ref.line,
              column: ref.column,
              rawSpecifier: ref.rawSpecifier,
            },
          });
        } else {
          diagnostics.push({
            code: "UNRESOLVED_IMPORT",
            message: `Cannot resolve import specifier "${ref.rawSpecifier}".`,
            file: relFile,
            line: ref.line,
            column: ref.column,
            severity: "WARNING",
          });
        }
      }
    }

    // Scan package.json for package-level entrypoints and references
    const pkgJsonPath = path.join(this.repoRoot, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
        const candidates = [
          pkg.main,
          pkg.module,
          typeof pkg.bin === "string" ? pkg.bin : undefined,
          ...(pkg.bin && typeof pkg.bin === "object" ? Object.values(pkg.bin) : []),
        ].filter(Boolean) as string[];

        for (const candidate of candidates) {
          const resolved = resolver.resolve(pkgJsonPath, candidate.startsWith("./") ? candidate : `./${candidate}`);
          if (resolved.type === "file" && resolved.resolvedPath) {
            graph.addEdge({
              from: "package.json",
              to: resolved.resolvedPath,
              kind: "config-reference",
              evidence: {
                file: "package.json",
                rawSpecifier: candidate,
              },
            });
          }
        }
      } catch {
        // Ignore malformed package.json
      }
    }

    const deterministicId = `analysis-${crypto
      .createHash("sha256")
      .update(`${commitSha}:${sourceFiles.length}:${graph.getAllEdges().length}`)
      .digest("hex")
      .slice(0, 12)}`;

    const result: AnalysisResult = {
      id: deterministicId,
      repository: snapshot,
      nodes: graph.getAllNodes(),
      edges: graph.getAllEdges(),
      diagnostics,
      createdAt: new Date().toISOString(),
    };

    return { result, graph };
  }
}
