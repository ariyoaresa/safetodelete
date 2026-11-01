import path from "node:path";

/**
 * Normalizes a file path to use POSIX forward slashes and removes redundant segments.
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * Converts an absolute or relative path to a repository-relative POSIX path.
 */
export function toRepoRelativePath(repoRoot: string, targetPath: string): string {
  const absRoot = path.resolve(repoRoot);
  const absTarget = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(repoRoot, targetPath);

  const rel = path.relative(absRoot, absTarget);
  return normalizePath(rel);
}

/**
 * Validates that a target path is safely inside the base directory without directory traversal escapes.
 * Throws an error if the path attempts to escape or targets dangerous directories.
 */
export function assertSafePathInside(baseDir: string, relativeOrAbsolutePath: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.isAbsolute(relativeOrAbsolutePath)
    ? path.resolve(relativeOrAbsolutePath)
    : path.resolve(baseDir, relativeOrAbsolutePath);

  const relative = path.relative(resolvedBase, resolvedTarget);

  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Security Violation: Path "${relativeOrAbsolutePath}" escapes base directory "${baseDir}".`);
  }

  // Reject .git folder modification
  const normalizedRel = normalizePath(relative);
  if (normalizedRel === ".git" || normalizedRel.startsWith(".git/")) {
    throw new Error(`Security Violation: Access to Git internal directory "${normalizedRel}" is prohibited.`);
  }

  return resolvedTarget;
}

