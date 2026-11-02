import fs from "node:fs";
import path from "node:path";
import { normalizePath } from "@safetodelete/shared";

const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".safetodelete",
]);

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

export interface DiscoveredFiles {
  sourceFiles: string[]; // repo-relative POSIX paths
  configFiles: string[]; // package.json, tsconfig.json, etc.
}

export function discoverRepositoryFiles(repoRoot: string): DiscoveredFiles {
  const rootAbs = path.resolve(repoRoot);
  const sourceFiles: string[] = [];
  const configFiles: string[] = [];

  function scan(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env.example" && entry.isDirectory()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        scan(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const fullPath = path.join(dir, entry.name);
        const relPath = normalizePath(path.relative(rootAbs, fullPath));
        const ext = path.extname(entry.name);

        if (
          entry.name === "package.json" ||
          entry.name.startsWith("tsconfig") ||
          entry.name.endsWith(".config.js") ||
          entry.name.endsWith(".config.ts") ||
          entry.name.endsWith(".config.mjs") ||
          entry.name.endsWith(".config.cjs")
        ) {
          configFiles.push(relPath);
        } else if (SUPPORTED_EXTENSIONS.has(ext)) {
          sourceFiles.push(relPath);
        }
      }
    }
  }

  scan(rootAbs);
  sourceFiles.sort();
  configFiles.sort();

  return { sourceFiles, configFiles };
}
