import { add } from "@/utils/math.js";
import { legacyHelper } from "./barrel/index.js";

export function calculateSummary(): string {
  const sum = add(5, 10);
  const legacy = legacyHelper();
  return `${sum}:${legacy}`;
}

