import ts from "typescript";
import type { AnalysisEdgeKind } from "@safetodelete/report-schema";

export interface ExtractedReference {
  rawSpecifier?: string;
  kind: AnalysisEdgeKind;
  isDynamic: boolean;
  isLiteral: boolean;
  line: number;
  column: number;
}

function getStringLiteralText(node?: ts.Node): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

export function parseJsTsReferences(filePath: string, sourceText: string): ExtractedReference[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );

  const references: ExtractedReference[] = [];

  function visit(node: ts.Node) {
    // 1. Static Import: import ... from '...'
    if (ts.isImportDeclaration(node)) {
      const text = getStringLiteralText(node.moduleSpecifier);
      if (text !== undefined) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        references.push({
          rawSpecifier: text,
          kind: "imports",
          isDynamic: false,
          isLiteral: true,
          line: line + 1,
          column: character + 1,
        });
      }
    }
    // 2. Export ... from '...'
    else if (ts.isExportDeclaration(node)) {
      const text = getStringLiteralText(node.moduleSpecifier);
      if (text !== undefined) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        references.push({
          rawSpecifier: text,
          kind: "reexports",
          isDynamic: false,
          isLiteral: true,
          line: line + 1,
          column: character + 1,
        });
      }
    }
    // 3. Dynamic import(...)
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const text = getStringLiteralText(arg);
      if (text !== undefined) {
        references.push({
          rawSpecifier: text,
          kind: "dynamic-import",
          isDynamic: true,
          isLiteral: true,
          line: line + 1,
          column: character + 1,
        });
      } else {
        references.push({
          rawSpecifier: undefined,
          kind: "dynamic-import",
          isDynamic: true,
          isLiteral: false,
          line: line + 1,
          column: character + 1,
        });
      }
    }
    // 4. require('...')
    else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      const arg = node.arguments[0];
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const text = getStringLiteralText(arg);
      if (text !== undefined) {
        references.push({
          rawSpecifier: text,
          kind: "imports",
          isDynamic: false,
          isLiteral: true,
          line: line + 1,
          column: character + 1,
        });
      } else if (arg) {
        references.push({
          rawSpecifier: undefined,
          kind: "dynamic-import",
          isDynamic: true,
          isLiteral: false,
          line: line + 1,
          column: character + 1,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return references;
}
