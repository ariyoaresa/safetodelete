export async function loadTarget() {
  // Literal dynamic import
  const module = await import("./target-dynamic.js");
  return module.dynamicTarget();
}

export async function loadNonLiteral(moduleName: string) {
  // Non-literal dynamic import (dynamic expression)
  const module = await import(`./${moduleName}.js`);
  return module;
}

