import { describe, it, expect } from "vitest";
import path from "node:path";
import { Analyzer } from "../src/analyzer.js";

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
});

