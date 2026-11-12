import { test } from "node:test";
import assert from "node:assert/strict";
import { instructions, comparer } from "./verifier-derive-schema.mjs";

test("instructions ignore commentaires, lignes vides et espaces", () => {
  const sql = `-- AlterTable
ALTER TABLE "a" ALTER COLUMN "x" DROP DEFAULT,
ALTER COLUMN "y" DROP DEFAULT;

-- DropIndex
DROP INDEX   "a_idx";
`;
  assert.deepEqual(instructions(sql), [
    'ALTER TABLE "a" ALTER COLUMN "x" DROP DEFAULT, ALTER COLUMN "y" DROP DEFAULT;',
    'DROP INDEX "a_idx";',
  ]);
});

test("un script vide de Prisma ne contient aucune instruction", () => {
  assert.deepEqual(instructions("-- This is an empty migration.\n"), []);
});

test("comparer signale les instructions nouvelles et disparues, sans tenir compte de l'ordre", () => {
  const acceptees = ["A;", "B;"];
  assert.deepEqual(comparer(acceptees, ["B;", "A;"]), { nouvelles: [], disparues: [] });
  assert.deepEqual(comparer(acceptees, ["A;", "C;"]), { nouvelles: ["C;"], disparues: ["B;"] });
  assert.deepEqual(comparer(["A;"], ["A;", "A;"]), { nouvelles: ["A;"], disparues: [] });
});
