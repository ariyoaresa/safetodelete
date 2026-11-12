import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  Analyzer,
  detectPackageManager,
  getPackageManagerScriptCommand,
  resolveDefaultCheckCommands,
  discoverRepositoryFiles,
} from "../src/index.js";

function withTempDir(fn: (dir: string) => void): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "safetodelete-analyzer-test-"));
  try {
    fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe("Analyzer & DependencyGraph", () => {
  const fixturePath = path.resolve(__dirname, "../../../fixtures/sample-project");

  it("discovers all files and parses AST correctly in sample-project", () => {
    const analyzer = new Analyzer({ repoRoot: fixturePath });
    const { result, graph } = analyzer.analyze();

    expect(result.repository.detectedLanguages).toContain("TypeScript");
    expect(result.nodes.length).toBeGreaterThan(5);

    // Verify path alias resolution (@/utils/math.js -> src/utils/math.ts)
    const mathDependants = graph.getDirectDependants(["src/utils/math.ts"]);
    expect(mathDependants).toContain("src/consumer.ts");
    expect(mathDependants).toContain("test/math.test.ts");

    // Verify barrel re-export (consumer -> barrel/index.ts -> barrel/legacy-helper.ts)
    const impact = graph.getImpactSummary(["src/barrel/legacy-helper.ts"]);
    expect(impact.direct).toContain("src/barrel/index.ts");
    expect(impact.transitive).toContain("src/consumer.ts");
    expect(impact.transitive).toContain("src/index.ts");

    // Verify dynamic literal import
    const dynDependants = graph.getDirectDependants(["src/dynamic/target-dynamic.ts"]);
    expect(dynDependants).toContain("src/dynamic/loader.ts");

    // Verify dynamic non-literal diagnostic
    const nonLiteralDiag = result.diagnostics.find(
      (d) => d.code === "DYNAMIC_NON_LITERAL_IMPORT"
    );
    expect(nonLiteralDiag).toBeDefined();
    expect(nonLiteralDiag?.file).toBe("src/dynamic/loader.ts");

    // Verify orphan file detection
    expect(graph.isOrphan("src/orphan.ts")).toBe(true);
    expect(graph.isOrphan("src/utils/math.ts")).toBe(false);
  });

  describe(".gitignore File Discovery", () => {
    it("respects root .gitignore, nested .gitignore, and negation (!) rules", () => {
      withTempDir((tmpDir) => {
        fs.mkdirSync(path.join(tmpDir, "src/generated"), { recursive: true });
        fs.mkdirSync(path.join(tmpDir, "src/feature"), { recursive: true });
        fs.mkdirSync(path.join(tmpDir, "vendor"), { recursive: true });

        fs.writeFileSync(
          path.join(tmpDir, ".gitignore"),
          [
            "# Root ignore rules",
            "vendor/",
            "*.gen.ts",
            "!src/keep.gen.ts",
            "/root-only.ts",
          ].join("\n")
        );

        // Nested .gitignore inside src/feature
        fs.writeFileSync(
          path.join(tmpDir, "src/feature/.gitignore"),
          "local-scratch.ts\n"
        );

        fs.writeFileSync(path.join(tmpDir, "root-only.ts"), "export const a = 1;");
        fs.writeFileSync(path.join(tmpDir, "src/root-only.ts"), "export const b = 2;");
        fs.writeFileSync(path.join(tmpDir, "src/index.ts"), "export const main = true;");
        fs.writeFileSync(path.join(tmpDir, "src/skip.gen.ts"), "export const skip = true;");
        fs.writeFileSync(path.join(tmpDir, "src/keep.gen.ts"), "export const keep = true;");
        fs.writeFileSync(path.join(tmpDir, "src/feature/active.ts"), "export const act = 1;");
        fs.writeFileSync(path.join(tmpDir, "src/feature/local-scratch.ts"), "export const s = 1;");
        fs.writeFileSync(path.join(tmpDir, "vendor/lib.ts"), "export const v = 1;");

        const discovered = discoverRepositoryFiles(tmpDir);

        expect(discovered.sourceFiles).toEqual([
          "src/feature/active.ts",
          "src/index.ts",
          "src/keep.gen.ts",
          "src/root-only.ts",
        ]);
      });
    });

    it("supports disabling .gitignore and passing extraIgnorePatterns", () => {
      withTempDir((tmpDir) => {
        fs.writeFileSync(path.join(tmpDir, ".gitignore"), "ignored.ts\n");
        fs.writeFileSync(path.join(tmpDir, "ignored.ts"), "export const x = 1;");
        fs.writeFileSync(path.join(tmpDir, "custom-skip.ts"), "export const y = 2;");
        fs.writeFileSync(path.join(tmpDir, "kept.ts"), "export const z = 3;");

        const withoutGitignore = discoverRepositoryFiles(tmpDir, {
          respectGitignore: false,
          extraIgnorePatterns: ["custom-skip.ts"],
        });

        expect(withoutGitignore.sourceFiles).toEqual(["ignored.ts", "kept.ts"]);
      });
    });
  });

  describe("Package-Manager-Aware Detection & Script Resolution", () => {
    it("detects package manager from packageManager field and lockfiles", () => {
      withTempDir((tmpDir) => {
        fs.mkdirSync(path.join(tmpDir, ".git"));
        fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
        expect(detectPackageManager(tmpDir)).toBe("pnpm");

        // Sub-package inherits monorepo root lockfile detection
        const subPkg = path.join(tmpDir, "packages/app");
        fs.mkdirSync(subPkg, { recursive: true });
        expect(detectPackageManager(subPkg)).toBe("pnpm");

        // Explicit packageManager field in package.json takes precedence
        fs.writeFileSync(
          path.join(subPkg, "package.json"),
          JSON.stringify({ name: "app", packageManager: "yarn@4.5.0" })
        );
        expect(detectPackageManager(subPkg)).toBe("yarn");
      });

      withTempDir((tmpDir) => {
        fs.mkdirSync(path.join(tmpDir, ".git"));
        fs.writeFileSync(path.join(tmpDir, "bun.lock"), "");
        expect(detectPackageManager(tmpDir)).toBe("bun");
      });
    });

    it("resolves package-manager-specific test and build commands", () => {
      expect(getPackageManagerScriptCommand("pnpm", "test")).toBe("pnpm test");
      expect(getPackageManagerScriptCommand("pnpm", "build")).toBe("pnpm run build");
      expect(getPackageManagerScriptCommand("yarn", "test")).toBe("yarn test");
      expect(getPackageManagerScriptCommand("yarn", "build")).toBe("yarn run build");
      expect(getPackageManagerScriptCommand("bun", "test")).toBe("bun test");
      expect(getPackageManagerScriptCommand("bun", "build")).toBe("bun run build");
      expect(getPackageManagerScriptCommand("npm", "test")).toBe("npm test");
      expect(getPackageManagerScriptCommand("npm", "build")).toBe("npm run build");

      withTempDir((tmpDir) => {
        fs.writeFileSync(
          path.join(tmpDir, "package.json"),
          JSON.stringify({
            name: "sample",
            packageManager: "pnpm@9.0.0",
            scripts: {
              test: "vitest run",
              build: "tsc",
            },
          })
        );

        expect(resolveDefaultCheckCommands(tmpDir)).toEqual([
          "pnpm test",
          "pnpm run build",
        ]);
      });
    });
  });
});


