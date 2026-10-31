import path from "node:path";
import fs from "node:fs";
import ts from "typescript";
import { normalizePath } from "@safetodelete/shared";

export interface PathAliasConfig {
  baseUrl?: string;
  paths?: Record<string, string[]>;
}

export interface ResolveResult {
  type: "file" | "package" | "unresolved";
  resolvedPath?: string; // repo-relative POSIX path
  packageName?: string;
}

const COMMON_EXTENSIONS = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
];

export class ModuleResolver {
  private repoRoot: string;
  private aliasConfig?: PathAliasConfig;
  private tsconfigCache: Map<string, PathAliasConfig | undefined> = new Map();

  constructor(repoRoot: string, aliasConfig?: PathAliasConfig) {
    this.repoRoot = path.resolve(repoRoot);
    this.aliasConfig = aliasConfig;
  }

  private getTsConfigForFile(absFromFile: string): PathAliasConfig | undefined {
    let currentDir = path.dirname(absFromFile);
    const root = path.resolve(this.repoRoot);

    while (currentDir.startsWith(root) || currentDir === root) {
      if (this.tsconfigCache.has(currentDir)) {
        return this.tsconfigCache.get(currentDir);
      }
      const candidate = path.join(currentDir, "tsconfig.json");
      if (fs.existsSync(candidate)) {
        const loaded = ModuleResolver.loadTsConfig(currentDir);
        if (loaded) {
          this.tsconfigCache.set(currentDir, loaded);
          return loaded;
        }
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
    }
    return this.aliasConfig;
  }

  /**
   * Loads path aliases and baseUrl from tsconfig.json using TypeScript parser.
   */
  public static loadTsConfig(repoRoot: string): PathAliasConfig | undefined {
    const tsconfigPath = path.join(repoRoot, "tsconfig.json");
    if (!fs.existsSync(tsconfigPath)) {
      return undefined;
    }

    try {
      const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      if (configFile.error || !configFile.config) {
        return undefined;
      }

      const compilerOptions = configFile.config.compilerOptions || {};

      let baseUrl: string | undefined = compilerOptions.baseUrl;
      if (baseUrl && !path.isAbsolute(baseUrl)) {
        baseUrl = path.resolve(repoRoot, baseUrl);
      }

      return {
        baseUrl,
        paths: compilerOptions.paths,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Resolves a raw module specifier from a given file in the repository.
   */
  public resolve(fromFilePath: string, specifier: string): ResolveResult {
    const absFromFile = path.isAbsolute(fromFilePath)
      ? fromFilePath
      : path.resolve(this.repoRoot, fromFilePath);

    const fromDir = path.dirname(absFromFile);
    const activeAliasConfig = this.getTsConfigForFile(absFromFile);

    // 1. Relative imports: ./ or ../
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const targetBase = path.resolve(fromDir, specifier);
      const resolved = this.tryExtensions(targetBase);
      if (resolved) {
        return {
          type: "file",
          resolvedPath: normalizePath(path.relative(this.repoRoot, resolved)),
        };
      }
      return { type: "unresolved" };
    }

    // 2. TypeScript path aliases: e.g. "@/..." -> "src/..."
    if (activeAliasConfig?.paths && activeAliasConfig.baseUrl) {
      for (const [pattern, replacements] of Object.entries(activeAliasConfig.paths)) {
        const starIndex = pattern.indexOf("*");
        if (starIndex !== -1) {
          const prefix = pattern.slice(0, starIndex);
          const suffix = pattern.slice(starIndex + 1);

          if (specifier.startsWith(prefix) && specifier.endsWith(suffix)) {
            const matched = specifier.slice(prefix.length, specifier.length - suffix.length);

            for (const replacement of replacements) {
              const targetPattern = replacement.replace("*", matched);
              const targetBase = path.resolve(activeAliasConfig.baseUrl, targetPattern);
              const resolved = this.tryExtensions(targetBase);
              if (resolved) {
                return {
                  type: "file",
                  resolvedPath: normalizePath(path.relative(this.repoRoot, resolved)),
                };
              }
            }
          }
        } else if (specifier === pattern) {
          for (const replacement of replacements) {
            const targetBase = path.resolve(activeAliasConfig.baseUrl, replacement);
            const resolved = this.tryExtensions(targetBase);
            if (resolved) {
              return {
                type: "file",
                resolvedPath: normalizePath(path.relative(this.repoRoot, resolved)),
              };
            }
          }
        }
      }
    }

    // 3. Fallback: BaseUrl lookup
    if (activeAliasConfig?.baseUrl) {
      const targetBase = path.resolve(activeAliasConfig.baseUrl, specifier);
      const resolved = this.tryExtensions(targetBase);
      if (resolved) {
        return {
          type: "file",
          resolvedPath: normalizePath(path.relative(this.repoRoot, resolved)),
        };
      }
    }

    // 4. External package (e.g., "react", "lodash", "@org/package")
    if (!specifier.startsWith("/") && !specifier.startsWith(".")) {
      const parts = specifier.split("/");
      const packageName = specifier.startsWith("@") && parts.length >= 2
        ? `${parts[0]}/${parts[1]}`
        : parts[0];
      return {
        type: "package",
        packageName,
      };
    }

    return { type: "unresolved" };
  }

  private tryExtensions(baseCandidate: string): string | null {
    // If the path directly exists as a file
    if (fs.existsSync(baseCandidate) && fs.statSync(baseCandidate).isFile()) {
      return baseCandidate;
    }

    // If candidate has a .js/.jsx extension, also try .ts/.tsx (typical in TS ESM)
    if (baseCandidate.endsWith(".js")) {
      const tsCandidate = baseCandidate.slice(0, -3) + ".ts";
      if (fs.existsSync(tsCandidate) && fs.statSync(tsCandidate).isFile()) {
        return tsCandidate;
      }
      const tsxCandidate = baseCandidate.slice(0, -3) + ".tsx";
      if (fs.existsSync(tsxCandidate) && fs.statSync(tsxCandidate).isFile()) {
        return tsxCandidate;
      }
    }

    // Try standard extension candidates
    for (const ext of COMMON_EXTENSIONS) {
      const full = baseCandidate + ext;
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        return full;
      }
    }

    return null;
  }
}

