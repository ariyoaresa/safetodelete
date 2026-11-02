import { describe, it, expect } from "vitest";
import { DependencyGraph } from "../src/graph.js";

describe("DependencyGraph", () => {
  it("classifies scoped packages as package kind, not file", () => {
    const graph = new DependencyGraph();
    graph.addEdge({
      from: "src/index.ts",
      to: "@safetodelete/report-schema",
      kind: "package-dependency",
      evidence: { file: "src/index.ts" },
    });
    graph.addEdge({
      from: "src/index.ts",
      to: "@types/node",
      kind: "imports",
      evidence: { file: "src/index.ts" },
    });
    graph.addEdge({
      from: "src/index.ts",
      to: "lodash",
      kind: "imports",
      evidence: { file: "src/index.ts" },
    });
    graph.addEdge({
      from: "src/index.ts",
      to: "src/utils/math.ts",
      kind: "imports",
      evidence: { file: "src/index.ts" },
    });

    const schemaNode = graph.getNode("@safetodelete/report-schema");
    expect(schemaNode).toBeDefined();
    expect(schemaNode?.kind).toBe("package");

    const typesNode = graph.getNode("@types/node");
    expect(typesNode).toBeDefined();
    expect(typesNode?.kind).toBe("package");

    const lodashNode = graph.getNode("lodash");
    expect(lodashNode).toBeDefined();
    expect(lodashNode?.kind).toBe("package");

    const fileNode = graph.getNode("src/utils/math.ts");
    expect(fileNode).toBeDefined();
    expect(fileNode?.kind).toBe("file");
  });

  it("handles circular dependencies without infinite loops", () => {
    const graph = new DependencyGraph();
    graph.addEdge({
      from: "src/a.ts",
      to: "src/b.ts",
      kind: "imports",
      evidence: { file: "src/a.ts" },
    });
    graph.addEdge({
      from: "src/b.ts",
      to: "src/a.ts",
      kind: "imports",
      evidence: { file: "src/b.ts" },
    });
    graph.addEdge({
      from: "src/c.ts",
      to: "src/b.ts",
      kind: "imports",
      evidence: { file: "src/c.ts" },
    });

    const impactA = graph.getImpactSummary(["src/a.ts"]);
    expect(impactA.direct).toContain("src/b.ts");
    expect(impactA.transitive).toContain("src/c.ts");

    const impactB = graph.getImpactSummary(["src/b.ts"]);
    expect(impactB.direct).toContain("src/a.ts");
    expect(impactB.direct).toContain("src/c.ts");
  });

  it("expands directory targets to include all nested files", () => {
    const graph = new DependencyGraph();
    graph.addNode({ id: "src/components/button.tsx", path: "src/components/button.tsx", kind: "file" });
    graph.addNode({ id: "src/components/card.tsx", path: "src/components/card.tsx", kind: "file" });
    graph.addNode({ id: "src/app.tsx", path: "src/app.tsx", kind: "file" });

    graph.addEdge({
      from: "src/app.tsx",
      to: "src/components/button.tsx",
      kind: "imports",
      evidence: { file: "src/app.tsx" },
    });
    graph.addEdge({
      from: "src/components/card.tsx",
      to: "src/components/button.tsx",
      kind: "imports",
      evidence: { file: "src/components/card.tsx" },
    });

    // When passing folder "src/components"
    const direct = graph.getDirectDependants(["src/components"]);
    // src/app.tsx imports button.tsx, and is OUTSIDE src/components, so it is a direct dependant
    expect(direct).toContain("src/app.tsx");
    // src/components/card.tsx is INSIDE src/components, so it is part of the deletion targets, not an external dependant
    expect(direct).not.toContain("src/components/card.tsx");

    const impact = graph.getImpactSummary(["src/components"]);
    expect(impact.direct).toContain("src/app.tsx");
  });

  it("detects orphan files accurately", () => {
    const graph = new DependencyGraph();
    graph.addNode({ id: "src/orphan.ts", path: "src/orphan.ts", kind: "file" });
    graph.addNode({ id: "src/used.ts", path: "src/used.ts", kind: "file" });
    graph.addEdge({
      from: "src/app.ts",
      to: "src/used.ts",
      kind: "imports",
      evidence: { file: "src/app.ts" },
    });

    expect(graph.isOrphan("src/orphan.ts")).toBe(true);
    expect(graph.isOrphan("src/used.ts")).toBe(false);
  });
});

