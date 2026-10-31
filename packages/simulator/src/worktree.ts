import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { assertSafePathInside } from "@safetodelete/shared";

export interface SimulationWorktreeOptions {
  repoRoot: string;
  baseSha?: string;
  allowDirty?: boolean;
  worktreeParentDir?: string;
}

export interface WorktreeHandle {
  id: string;
  worktreePath: string;
  baseSha: string;
  applyDeletion: (targets: string[]) => string[];
  cleanup: () => void;
}

export class WorktreeManager {
  private repoRoot: string;
  private baseSha?: string;
  private allowDirty: boolean;
  private worktreeParentDir: string;

  constructor(options: SimulationWorktreeOptions) {
    this.repoRoot = path.resolve(options.repoRoot);
    this.baseSha = options.baseSha;
    this.allowDirty = !!options.allowDirty;
    this.worktreeParentDir = options.worktreeParentDir
      ? path.resolve(options.worktreeParentDir)
      : path.join(this.repoRoot, ".safetodelete", "worktrees");
  }

  public createWorktree(): WorktreeHandle {
    // 1. Verify Git status
    let isDirty = false;
    try {
      const status = execSync("git status --porcelain", {
        cwd: this.repoRoot,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf-8",
      }).trim();
      isDirty = status.length > 0;
    } catch (err) {
      throw new Error(`Failed to check Git repository status: ${(err as Error).message}`);
    }

    if (isDirty && !this.allowDirty) {
      throw new Error(
        `Simulation Aborted: Working tree has uncommitted changes. Commit your changes or specify allowDirty=true to simulate against committed HEAD without modifying your working tree.`
      );
    }

    // 2. Resolve commit SHA
    let resolvedSha = this.baseSha;
    if (!resolvedSha) {
      try {
        resolvedSha = execSync("git rev-parse HEAD", {
          cwd: this.repoRoot,
          stdio: ["ignore", "pipe", "ignore"],
          encoding: "utf-8",
        }).trim();
      } catch (err) {
        throw new Error(`Failed to resolve Git commit SHA: ${(err as Error).message}`);
      }
    }

    // 3. Prepare unique worktree directory
    const id = `sim-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    fs.mkdirSync(this.worktreeParentDir, { recursive: true });
    const worktreePath = path.join(this.worktreeParentDir, id);

    // 4. Create detached Git worktree
    try {
      execSync(`git worktree add --detach "${worktreePath}" ${resolvedSha}`, {
        cwd: this.repoRoot,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      throw new Error(`Failed to create Git worktree at "${worktreePath}": ${(err as Error).message}`);
    }

    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      try {
        execSync(`git worktree remove --force "${worktreePath}"`, {
          cwd: this.repoRoot,
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch {
        // Fallback cleanup if worktree remove encounters issue
      }

      try {
        execSync("git worktree prune", {
          cwd: this.repoRoot,
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch {
        // Ignore
      }

      try {
        if (fs.existsSync(worktreePath)) {
          fs.rmSync(worktreePath, { recursive: true, force: true });
        }
      } catch {
        // Ignore
      }
    };

    // Register cleanup hooks for process exit
    const exitListener = () => cleanup();
    process.once("exit", exitListener);
    process.once("SIGINT", exitListener);
    process.once("SIGTERM", exitListener);

    const applyDeletion = (targets: string[]): string[] => {
      const deletedPaths: string[] = [];
      for (const target of targets) {
        // Validate target path is strictly inside worktree and does not escape or target .git
        const safeTarget = assertSafePathInside(worktreePath, target);

        if (fs.existsSync(safeTarget)) {
          fs.rmSync(safeTarget, { recursive: true, force: true });
          deletedPaths.push(target);
        } else {
          throw new Error(`Target path "${target}" does not exist in worktree simulation.`);
        }
      }
      return deletedPaths;
    };

    return {
      id,
      worktreePath,
      baseSha: resolvedSha,
      applyDeletion,
      cleanup: () => {
        cleanup();
        process.removeListener("exit", exitListener);
        process.removeListener("SIGINT", exitListener);
        process.removeListener("SIGTERM", exitListener);
      },
    };
  }
}

