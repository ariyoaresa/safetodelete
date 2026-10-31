import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { executeSimulation } from "../src/engine.js";

describe("SafeToDelete CLI End-to-End Simulation", () => {
  const repoRoot = path.resolve(__dirname, "../../..");
  const orphanPath = "fixtures/sample-project/src/orphan.ts";
  const mathPath = "fixtures/sample-project/src/utils/math.ts";

  it("simulates safe orphan deletion yielding LOW risk with working checkout unchanged", async () => {
    const report = await executeSimulation({
      repoRoot,
      targets: [orphanPath],
      allowDirty: true,
      checkCommands: [
        "node --test fixtures/sample-project/test/math.test.ts",
      ],
    });

    expect(report.riskCategory).toBe("LOW");
    expect(report.dependantsFound.direct.length).toBe(0);
    expect(report.checks[0].status).toBe("PASSED");

    // Invariant: original file still exists!
    expect(fs.existsSync(path.join(repoRoot, orphanPath))).toBe(true);
  });

  it("simulates breaking deletion yielding HIGH risk with dependants and test failure", async () => {
    const report = await executeSimulation({
      repoRoot,
      targets: [mathPath],
      allowDirty: true,
      checkCommands: [
        "node --test fixtures/sample-project/test/math.test.ts",
      ],
    });

    expect(report.riskCategory).toBe("HIGH");
    expect(report.dependantsFound.direct).toContain("fixtures/sample-project/src/consumer.ts");
    expect(report.dependantsFound.direct).toContain("fixtures/sample-project/test/math.test.ts");

    // The test in the worktree should have failed because math.ts was deleted
    expect(report.checks[0].status).toBe("FAILED");

    // Invariant: original file still exists!
    expect(fs.existsSync(path.join(repoRoot, mathPath))).toBe(true);
  });
});

