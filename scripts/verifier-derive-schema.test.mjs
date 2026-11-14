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

for (const commentaire of [
  "-- commentaire en fin de ligne",
  "/* commentaire sur une ligne */",
  "/* commentaire\nsur plusieurs lignes */",
]) {
  test(`instructions ignore un commentaire après le point-virgule : ${commentaire}`, () => {
    const sql = `DROP INDEX "a_idx"; ${commentaire}\nDROP INDEX "b_idx";`
    const attendues = ['DROP INDEX "a_idx";', 'DROP INDEX "b_idx";']
    assert.deepEqual(instructions(sql), attendues)
    assert.deepEqual(comparer(instructions(sql), instructions(attendues.join("\n"))), {
      nouvelles: [], disparues: [],
    })
  })
}

test("instructions ignore les blocs entre les mots et les commentaires seuls", () => {
  assert.deepEqual(instructions('/* en-tête\n-- descriptif ; */\nDROP/* index */ INDEX "a_idx";\n/* fin */'), [
    'DROP INDEX "a_idx";',
  ])
  assert.deepEqual(instructions('/* rien ;\nà comparer */ -- fin'), [])
})

test("les marqueurs de commentaires dans les chaînes et identifiants restent significatifs", () => {
  const sql = `ALTER TABLE "a--/*b*/" ALTER COLUMN "x" SET DEFAULT 'texte -- /* conservé */'; -- note`
  assert.deepEqual(instructions(sql), [sql.slice(0, sql.indexOf(';') + 1)])
  assert.equal(comparer(instructions(sql), instructions(sql.replace('conservé', 'modifié'))).nouvelles.length, 1)
})

test("les blocs imbriqués sont ignorés sans perdre les instructions voisines", () => {
  assert.deepEqual(instructions('DROP INDEX "a"; /* avant /* interne ; */ après */ DROP INDEX "b";'), [
    'DROP INDEX "a";', 'DROP INDEX "b";',
  ])
})

test("les guillemets SQL doublés, chaînes échappées et dollar-quoted gardent leur contenu", () => {
  for (const valeur of ["'l''avoir -- /* ; */  conservé'", String.raw`E'l\'avoir -- /* ; */'`, '$texte$-- /* ; */\n  conservé$texte$', '$$-- /* ; */$$']) {
    const sql = `ALTER TABLE "a" ALTER COLUMN "x" SET DEFAULT ${valeur};`
    assert.deepEqual(instructions(`${sql} -- note\nDROP INDEX "a""--b";`), [sql, 'DROP INDEX "a""--b";'])
  }
})
