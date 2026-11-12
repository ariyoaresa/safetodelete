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

export interface DiscoverOptions {
  respectGitignore?: boolean;
  extraIgnorePatterns?: string[];
}

interface GitignoreRule {
  baseDirRel: string; // POSIX relative directory where the .gitignore lives ("" for root)
  negated: boolean;
  dirOnly: boolean;
  anchored: boolean;
  regex: RegExp;
}

function globToRegexSource(glob: string): string {
  let out = "";
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          out += "(?:.*/)?";
          i += 3;
          continue;
        }
        out += ".*";
        i += 2;
        continue;
      }
      out += "[^/]*";
      i++;
    } else if (ch === "?") {
      out += "[^/]";
      i++;
    } else if (ch === "[") {
      const closeIdx = glob.indexOf("]", i + 1);
      if (closeIdx !== -1) {
        const content = glob.slice(i + 1, closeIdx);
        const negatedClass = content.startsWith("!") || content.startsWith("^");
        const body = negatedClass ? `^${content.slice(1)}` : content;
        out += `[${body}]`;
        i = closeIdx + 1;
      } else {
        out += "\\[";
        i++;
      }
    } else if ("+()^$.{}|\\".includes(ch)) {
      out += `\\${ch}`;
      i++;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

export function parseGitignoreContent(content: string, baseDirRel = ""): GitignoreRule[] {
  const rules: GitignoreRule[] = [];
  const lines = content.split(/\r?\n/);

  for (let rawLine of lines) {
    // Strip unescaped trailing whitespace
    rawLine = rawLine.replace(/(?<!\\)\s+$/, "");
    if (!rawLine) continue;

    // Skip comments unless escaped (\#)
    if (rawLine.startsWith("#")) continue;

    let negated = false;
    let pattern = rawLine;

    if (pattern.startsWith("!")) {
      negated = true;
      pattern = pattern.slice(1);
    } else if (pattern.startsWith("\\#") || pattern.startsWith("\\!")) {
      pattern = pattern.slice(1);
    }

    pattern = pattern.replace(/\\ /g, " ");
    if (!pattern) continue;

    let dirOnly = false;
    if (pattern.endsWith("/")) {
      dirOnly = true;
      pattern = pattern.replace(/\/+$/, "");
      if (!pattern) continue;
    }

    // A pattern is anchored to baseDirRel if it starts with "/" or contains "/" in the middle
    let anchored = false;
    if (pattern.startsWith("/")) {
      anchored = true;
      pattern = pattern.replace(/^\/+/, "");
    } else if (pattern.includes("/")) {
      anchored = true;
    }

    const regexBody = globToRegexSource(pattern);
    // If anchored, match from the start of relative path inside baseDirRel;
    // otherwise match either at start or after any "/" segment, and optionally match descendants.
    const fullRegex = anchored
      ? new RegExp(`^${regexBody}(?:$|/)`)
      : new RegExp(`(?:^|/)${regexBody}(?:$|/)`);

    rules.push({
      baseDirRel,
      negated,
      dirOnly,
      anchored,
      regex: fullRegex,
    });
  }

  return rules;
}

function isIgnoredByRules(relPath: string, isDirectory: boolean, rules: GitignoreRule[]): boolean {
  let ignored = false;

  for (const rule of rules) {
    if (rule.dirOnly && !isDirectory) {
      // A directory-only rule still ignores files inside that directory if the parent wasn't skipped,
      // wait: during traversal, ignored directories are skipped immediately when isDirectory === true.
      continue;
    }

    let pathWithinBase = relPath;
    if (rule.baseDirRel) {
      if (relPath === rule.baseDirRel) continue;
      if (!relPath.startsWith(rule.baseDirRel + "/")) continue;
      pathWithinBase = relPath.slice(rule.baseDirRel.length + 1);
    }

    if (rule.regex.test(pathWithinBase)) {
      ignored = !rule.negated;
    }
  }

  return ignored;
}

export function discoverRepositoryFiles(
  repoRoot: string,
  options?: DiscoverOptions
): DiscoveredFiles {
  const rootAbs = path.resolve(repoRoot);
  let rootReal = rootAbs;
  try {
    rootReal = fs.realpathSync(rootAbs);
  } catch {
    // Keep resolved path if realpath fails
  }

  const respectGitignore = options?.respectGitignore ?? true;
  const sourceFiles: string[] = [];
  const configFiles: string[] = [];
  const visitedRealDirs = new Set<string>([rootReal]);

  const initialRules: GitignoreRule[] = [];
  if (options?.extraIgnorePatterns && options.extraIgnorePatterns.length > 0) {
    initialRules.push(...parseGitignoreContent(options.extraIgnorePatterns.join("\n"), ""));
  }

  function scan(dir: string, inheritedRules: GitignoreRule[]) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const dirRel = normalizePath(path.relative(rootAbs, dir));
    let activeRules = inheritedRules;

    if (respectGitignore) {
      const gitignorePath = path.join(dir, ".gitignore");
      if (fs.existsSync(gitignorePath)) {
        try {
          const stat = fs.lstatSync(gitignorePath);
          if (stat.isFile()) {
            const content = fs.readFileSync(gitignorePath, "utf-8");
            const localRules = parseGitignoreContent(content, dirRel === "." ? "" : dirRel);
            if (localRules.length > 0) {
              activeRules = [...inheritedRules, ...localRules];
            }
          }
        } catch {
          // Ignore unreadable .gitignore
        }
      }
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = normalizePath(path.relative(rootAbs, fullPath));

      let isDir = entry.isDirectory();
      let isFile = entry.isFile();

      // Safely handle symlinks: reject escapes outside repoRoot and prevent cycles
      if (entry.isSymbolicLink()) {
        try {
          const targetReal = fs.realpathSync(fullPath);
          const relToRoot = path.relative(rootReal, targetReal);
          if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) {
            continue;
          }
          const targetStat = fs.statSync(targetReal);
          if (targetStat.isDirectory()) {
            if (visitedRealDirs.has(targetReal)) {
              continue;
            }
            visitedRealDirs.add(targetReal);
            isDir = true;
          } else if (targetStat.isFile()) {
            isFile = true;
          }
        } catch {
          // Broken or inaccessible symlink
          continue;
        }
      }

      if (entry.name.startsWith(".") && entry.name !== ".env.example" && isDir) {
        continue;
      }

      if (isDir) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        if (activeRules.length > 0 && isIgnoredByRules(relPath, true, activeRules)) {
          continue;
        }
        scan(fullPath, activeRules);
      } else if (isFile) {
        if (activeRules.length > 0 && isIgnoredByRules(relPath, false, activeRules)) {
          continue;
        }

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

  scan(rootAbs, initialRules);
  sourceFiles.sort();
  configFiles.sort();

  return { sourceFiles, configFiles };
}

