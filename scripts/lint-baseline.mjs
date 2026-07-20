import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function parseAddedLines(diff) {
  const added = new Map();
  let file;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      file = line.slice(6);
      continue;
    }

    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!file || !hunk) continue;

    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    const lines = added.get(file) ?? new Set();
    for (let number = start; number < start + count; number += 1) lines.add(number);
    added.set(file, lines);
  }

  return added;
}

export function summarize(results) {
  return results.reduce(
    (totals, result) => ({
      errors: totals.errors + result.errorCount,
      warnings: totals.warnings + result.warningCount,
    }),
    { errors: 0, warnings: 0 },
  );
}

export function violationsOnAddedLines(results, addedLines, cwd = root) {
  return results.flatMap((result) => {
    const relative = path.relative(cwd, result.filePath).split(path.sep).join("/");
    const lines = addedLines.get(relative);
    if (!lines) return [];
    return result.messages
      .filter((message) => lines.has(message.line))
      .map((message) => ({ relative, ...message }));
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage: node scripts/lint-baseline.mjs [--base <git-sha>]");
    return;
  }

  const baseIndex = args.indexOf("--base");
  const base = baseIndex >= 0 ? args[baseIndex + 1] : undefined;
  if (baseIndex >= 0 && !base) throw new Error("--base requires a git revision");

  const baseline = JSON.parse(
    await readFile(path.join(root, ".eslint-baseline.json"), "utf8"),
  );
  const eslint = path.join(root, "node_modules", ".bin", "eslint");
  const run = spawnSync(
    eslint,
    ["src", "--ext", ".ts,.tsx", "--format", "json"],
    { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );

  if (run.error) throw run.error;
  if (run.status !== 0 && run.status !== 1) {
    process.stderr.write(run.stderr);
    process.exit(run.status ?? 2);
  }

  const results = JSON.parse(run.stdout);
  const totals = summarize(results);
  const regressions = [];

  if (totals.errors > baseline.errors) {
    regressions.push(`errors ${totals.errors} > baseline ${baseline.errors}`);
  }
  if (totals.warnings > baseline.warnings) {
    regressions.push(`warnings ${totals.warnings} > baseline ${baseline.warnings}`);
  }

  if (base && !/^0+$/.test(base)) {
    const diff = spawnSync(
      "git",
      ["diff", "--unified=0", "--diff-filter=ACMR", `${base}..HEAD`, "--", "src"],
      { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    );
    if (diff.status !== 0) {
      process.stderr.write(diff.stderr);
      process.exit(diff.status ?? 2);
    }

    for (const violation of violationsOnAddedLines(results, parseAddedLines(diff.stdout))) {
      regressions.push(
        `${violation.relative}:${violation.line}:${violation.column} ${violation.ruleId ?? "eslint"} ${violation.message}`,
      );
    }
  }

  console.log(
    `ESLint debt: ${totals.errors} errors, ${totals.warnings} warnings ` +
      `(baseline: ${baseline.errors}/${baseline.warnings})`,
  );

  if (regressions.length > 0) {
    console.error("Lint quality gate failed:\n" + regressions.map((item) => `- ${item}`).join("\n"));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(2);
  });
}
