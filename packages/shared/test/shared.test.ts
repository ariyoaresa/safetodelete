import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  normalizePath,
  toRepoRelativePath,
  assertSafePathInside,
  redactSecrets,
  getSanitizedEnvironment,
} from "../src/index.js";

describe("Shared Utilities & Security", () => {
  it("normalizes paths to POSIX slashes", () => {
    expect(normalizePath("src\\utils\\math.ts")).toBe("src/utils/math.ts");
    expect(normalizePath("src/utils/math.ts")).toBe("src/utils/math.ts");
  });

  it("calculates repository relative path correctly", () => {
    const root = path.resolve("C:/my-repo");
    const target = path.resolve("C:/my-repo/src/index.ts");
    expect(toRepoRelativePath(root, target)).toBe("src/index.ts");
  });

  it("assertSafePathInside throws on directory traversal escape", () => {
    const baseDir = path.resolve("C:/my-repo/worktree");
    expect(() => {
      assertSafePathInside(baseDir, "../outside-file.txt");
    }).toThrow(/Security Violation.*escapes/);

    expect(() => {
      assertSafePathInside(baseDir, "../../etc/passwd");
    }).toThrow(/Security Violation.*escapes/);
  });

  it("assertSafePathInside throws on targeting .git", () => {
    const baseDir = path.resolve("C:/my-repo/worktree");
    expect(() => {
      assertSafePathInside(baseDir, ".git");
    }).toThrow(/Security Violation.*Git internal directory/);

    expect(() => {
      assertSafePathInside(baseDir, ".git/config");
    }).toThrow(/Security Violation.*Git internal directory/);
  });

  it("assertSafePathInside allows valid relative paths", () => {
    const baseDir = path.resolve("C:/my-repo/worktree");
    const valid = assertSafePathInside(baseDir, "src/components/button.tsx");
    expect(valid).toBe(path.join(baseDir, "src/components/button.tsx"));
  });

  it("redacts secret tokens, bearer auth, and private keys", () => {
    const sample = `
      Error occurred with authorization Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz
      GitHub token: ghp_123456789012345678901234567890123456
      AWS: AKIAIOSFODNN7EXAMPLE
      Config: api_key="super_secret_api_key_12345"
    `;

    const cleaned = redactSecrets(sample);
    expect(cleaned).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz");
    expect(cleaned).not.toContain("ghp_123456789012345678901234567890123456");
    expect(cleaned).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(cleaned).not.toContain("super_secret_api_key_12345");
    expect(cleaned).toContain("[REDACTED");
  });

  it("sanitizes environment variables allowlisting safe keys only", () => {
    process.env.AWS_SECRET_ACCESS_KEY = "leaked-secret";
    process.env.GITHUB_TOKEN = "ghp_private-token";
    const env = getSanitizedEnvironment();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.NODE_ENV).toBe("test");
    expect(env.CI).toBe("true");
  });
});

