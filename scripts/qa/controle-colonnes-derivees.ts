/**
 * Contrôle des colonnes dérivées des référentiels : `nom_normalise` doit valoir
 * `gleba_cle_referentiel(nom)` sur chaque ligne d'`itps`, `especes` et
 * `varietes` (fonction SQL posée par la migration 20260819190000, miroir de
 * `normalizeReferentielKey`). Attendu : 0 écart par table. Un écart signifie
 * qu'une recherche normalisée ou une détection de doublon est fausse en silence.
 *
 * Lecture seule (comptages agrégés). Code de sortie 1 si un écart existe.
 *
 *   npx tsx --env-file=.env scripts/qa/controle-colonnes-derivees.ts
 */
import { PrismaClient, Prisma } from "@prisma/client"

const prisma = new PrismaClient()

const TABLES = ["itps", "especes", "varietes"] as const

async function main() {
  let ecarts = 0
  for (const table of TABLES) {
    const [ligne] = await prisma.$queryRaw<[{ total: bigint; divergentes: bigint }]>(
      Prisma.sql`
        SELECT count(*)::bigint AS total,
               count(*) FILTER (
                 WHERE "nom_normalise" IS NULL OR "nom_normalise" <> gleba_cle_referentiel("nom")
               )::bigint AS divergentes
          FROM ${Prisma.raw(`"${table}"`)}
         WHERE "nom" IS NOT NULL
      `,
    )
    const divergentes = Number(ligne.divergentes)
    ecarts += divergentes
    console.log(`${table.padEnd(9)} ${String(ligne.total).padStart(7)} lignes, ${divergentes} divergente(s)`)
  }
  if (ecarts > 0) {
    console.error(`\n${ecarts} ligne(s) dont la clé dérivée ne suit plus sa définition : reprise à jouer (UPDATE … SET nom_normalise = gleba_cle_referentiel(nom)).`)
    process.exitCode = 1
  } else {
    console.log("\nAucun écart : les clés dérivées suivent leur définition.")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
