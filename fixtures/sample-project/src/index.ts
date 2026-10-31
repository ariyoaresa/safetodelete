import { calculateSummary } from "./consumer.js";
import { loadTarget } from "./dynamic/loader.js";

export async function run(): Promise<string> {
  const sum = calculateSummary();
  const dyn = await loadTarget();
  return `${sum} - ${dyn}`;
}

