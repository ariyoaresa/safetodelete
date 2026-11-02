import { describe, it, expect } from "vitest";
import path from "node:path";
import { parseJsTsReferences, ModuleResolver } from "../src/index.js";

describe("Language JS/TS AST & Resolver", () => {
  const fixturePath = path.resolve(__dirname, "../../../fixtures/sample-project");

  it("parses static, dynamic, and CommonJS references", () => {
    const code = `
      import { add } from "./utils/math.js";
      export * from "./barrel/index.js";
      const dyn = import("./dynamic/target-dynamic.js");
      const dynNonLit = import(computedPath);
      const req = require("./legacy.js");
      const reqNonLit = require(someVar);
    `;

    const refs = parseJsTsReferences("test.ts", code);
    expect(refs.length).toBe(6);

    const staticImport = refs.find((r) => r.rawSpecifier === "./utils/math.js");
    expect(staticImport?.kind).toBe("imports");
    expect(staticImport?.isDynamic).toBe(false);

    const reexport = refs.find((r) => r.rawSpecifier === "./barrel/index.js");
    expect(reexport?.kind).toBe("reexports");

    const dynamicLit = refs.find((r) => r.rawSpecifier === "./dynamic/target-dynamic.js");
    expect(dynamicLit?.kind).toBe("dynamic-import");
    expect(dynamicLit?.isLiteral).toBe(true);

    const dynamicNonLit = refs.find((r) => r.isDynamic && !r.isLiteral && !r.rawSpecifier);
    expect(dynamicNonLit).toBeDefined();

    const cjsReq = refs.find((r) => r.rawSpecifier === "./legacy.js");
    expect(cjsReq?.kind).toBe("imports");
  });

  it("resolves relative paths, index files, and TypeScript extensions", () => {
    const resolver = new ModuleResolver(fixturePath);
    const resolved = resolver.resolve(
      path.join(fixturePath, "src/consumer.ts"),
      "./utils/math.js"
    );

    expect(resolved.type).toBe("file");
    expect(resolved.resolvedPath).toBe("src/utils/math.ts");
  });

  it("resolves TypeScript path aliases from tsconfig", () => {
    const tsconfig = ModuleResolver.loadTsConfig(fixturePath);
    const resolver = new ModuleResolver(fixturePath, tsconfig);

    const resolved = resolver.resolve(
      path.join(fixturePath, "src/consumer.ts"),
      "@/utils/math.js"
    );

    expect(resolved.type).toBe("file");
    expect(resolved.resolvedPath).toBe("src/utils/math.ts");
  });

  it("identifies external and scoped npm packages", () => {
    const resolver = new ModuleResolver(fixturePath);

    const standardPkg = resolver.resolve(
      path.join(fixturePath, "src/index.ts"),
      "vitest"
    );
    expect(standardPkg.type).toBe("package");
    expect(standardPkg.packageName).toBe("vitest");

    const scopedPkg = resolver.resolve(
      path.join(fixturePath, "src/index.ts"),
      "@types/node"
    );
    expect(scopedPkg.type).toBe("package");
    expect(scopedPkg.packageName).toBe("@types/node");
  });
});

