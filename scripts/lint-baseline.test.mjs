import assert from "node:assert/strict";
import test from "node:test";
import { parseAddedLines, summarize, violationsOnAddedLines } from "./lint-baseline.mjs";

test("parseAddedLines records only new-side hunk lines", () => {
  const diff = [
    "diff --git a/src/example.ts b/src/example.ts",
    "+++ b/src/example.ts",
    "@@ -2,0 +3,2 @@",
    "+const first = 1;",
    "+const second = 2;",
    "@@ -8 +10,0 @@",
    "-removed();",
  ].join("\n");

  assert.deepEqual([...parseAddedLines(diff).get("src/example.ts")], [3, 4]);
});

test("violationsOnAddedLines rejects a new violation but permits legacy debt", () => {
  const results = [{
    filePath: "/repo/src/example.ts",
    errorCount: 2,
    warningCount: 0,
    messages: [
      { line: 3, column: 1, ruleId: "new-rule", message: "new" },
      { line: 20, column: 1, ruleId: "legacy-rule", message: "legacy" },
    ],
  }];

  assert.equal(violationsOnAddedLines(results, new Map([["src/example.ts", new Set([3])]]), "/repo").length, 1);
  assert.deepEqual(summarize(results), { errors: 2, warnings: 0 });
});
