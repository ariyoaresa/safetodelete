import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { WorktreeManager } from "../src/worktree.js";

describe("WorktreeManager & Simulator", () => {
  const repoRoot = path.resolve(__dirname, "../../..");

  it("rejects path traversal attacks attempting to escape worktree", () => {
    const manager = new WorktreeManager({
      repoRoot,
      allowDirty: true,
    });

    const handle = manager.createWorktree();
    try {
      expect(() => {
        handle.applyDeletion(["../../README_FIRST.md"]);
      }).toThrow(/Security Violation/);

      expect(() => {
        handle.applyDeletion([".git"]);
      }).toThrow(/Security Violation/);
    } finally {
      handle.cleanup();
    }
  });

  it("applies deletion only in worktree without modifying original repository checkout", () => {
    const targetFile = "fixtures/sample-project/src/orphan.ts";
    const originalFullPath = path.join(repoRoot, targetFile);

    expect(fs.existsSync(originalFullPath)).toBe(true);

    const manager = new WorktreeManager({
      repoRoot,
      allowDirty: true,
    });

    const handle = manager.createWorktree();
    try {
      expect(fs.existsSync(handle.worktreePath)).toBe(true);

      const deleted = handle.applyDeletion([targetFile]);
      expect(deleted).toContain(targetFile);

      // Verify file is deleted in worktree
      const inWorktree = path.join(handle.worktreePath, targetFile);
      expect(fs.existsSync(inWorktree)).toBe(false);

      // Verify ORIGINAL file still exists in working tree!
      expect(fs.existsSync(originalFullPath)).toBe(true);
    } finally {
      handle.cleanup();
      expect(fs.existsSync(handle.worktreePath)).toBe(false);
    }
  });
});

