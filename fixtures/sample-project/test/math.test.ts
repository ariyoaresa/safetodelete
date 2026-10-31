import test from "node:test";
import assert from "node:assert";
import { add, multiply } from "../src/utils/math.js";

test("math operations", () => {
  assert.strictEqual(add(2, 3), 5);
  assert.strictEqual(multiply(4, 5), 20);
});

