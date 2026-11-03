/**
 * Remise à zéro EXHAUSTIVE du compte démo (`demo@gleba.fr`), sans supprimer
 * l'utilisateur.
 *
 * L'ancienne version listait les tables à la main : chaque module ajouté
 * depuis (ruche, lait livré, transformations du verger, capteurs, déclarations
 * d'élevage, banque…) restait en place et la démo se polluait d'un reset à
 * l'autre. Celle-ci part du schéma réel : toute table dont la colonne
 * `user_id` référence `users` est purgée pour ce compte, sauf une courte
 * liste de tables qui ne sont pas des données de la ferme (signalements de
 * bugs, retours, mesures d'audience). L'ordre est résolu par passes
 * successives : une suppression refusée par une clé étrangère est retentée
 * à la passe suivante, une fois ses dépendants partis.
 *
 * Avant la purge, les entrées de référentiel partagées à la communauté (ou
 * utilisées par d'autres membres) sont reprises par la sentinelle, comme à la
 * suppression d'un compte (constat M36 du registre ITP).
 *
 * Les fichiers (fonds de plan, justificatifs, registres, envois) vivent dans
 * les volumes du conteneur : ce script, lancé depuis l'hôte, ne les voit pas.
 * La procédure de reseed les efface à part (voir docs/demo-scenario.md).
 *
 * À lancer AVANT `prisma/seed-demo.ts`. Usage : `npx tsx prisma/reset-demo.ts`
 * Simulation sans écriture : `RESET_DEMO_SIMULATION=1 npx tsx prisma/reset-demo.ts`
 */

import { PrismaClient } from "@prisma/client"
import { reprendreReferentielCommunaute } from "../src/lib/account-lifecycle"
import { DEMO_EMAIL as DEMO_EMAIL_PAR_DEFAUT } from "../src/lib/demo"

const prisma = new PrismaClient()
const DEMO_EMAIL = process.env.DEMO_EMAIL_OVERRIDE || DEMO_EMAIL_PAR_DEFAUT
const SIMULATION = process.env.RESET_DEMO_SIMULATION === "1"

/**
 * Tables rattachées au compte qui ne décrivent pas la ferme : on les garde.
 * - bug_reports, feedback_* : matière de l'équipe (tri des signalements) ;
 * - activity_days, cookie_consents, growth_campaign_contacts : audience ;
 * - evolutions, evolution_votes, signalements : feuille de route et modération
 *   publiques, dont les compteurs ne doivent pas bouger avec un reseed.
 */
const TABLES_CONSERVEES = new Set([
  "users",
  "accounts",
  "bug_reports",
  "feedback_tokens",
  "feedback_responses",
  "activity_days",
  "cookie_consents",
  "growth_campaign_contacts",
  "evolutions",
  "evolution_votes",
  "signalements",
])

/** Colonnes, autres que `user_id`, qui rattachent une ligne au compte. */
const AUTRES_RATTACHEMENTS: Array<[table: string, colonne: string]> = [
  ["membres_exploitation", "proprietaire_id"],
  ["aliments", "owner_user_id"],
]

type Cible = { table: string; colonne: string }

async function ciblesDuSchema(): Promise<Cible[]> {
  // Toutes les colonnes `user_id`, avec ou sans clé étrangère : plusieurs
  // tables d'élevage (pesées, pedigrees, tests de santé, tâches de terrain…)
  // portent l'identifiant du compte sans contrainte déclarée.
  const lignes = await prisma.$queryRaw<Array<{ table: string }>>`
    SELECT DISTINCT c.table_name AS "table"
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'user_id'
      AND t.table_type = 'BASE TABLE'
    ORDER BY 1`
  const cibles = lignes
    .map((l) => l.table)
    .filter((t) => !TABLES_CONSERVEES.has(t))
    .map((table) => ({ table, colonne: "user_id" }))
  for (const [table, colonne] of AUTRES_RATTACHEMENTS) cibles.push({ table, colonne })
  return cibles
}

const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`Identifiant SQL inattendu : ${s}`)
  return `"${s}"`
}

async function compter(c: Cible, userId: string): Promise<number> {
  const r = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*)::bigint AS n FROM ${ident(c.table)} WHERE ${ident(c.colonne)} = $1`,
    userId,
  )
  return Number(r[0]?.n ?? 0)
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })
  if (!user) {
    console.log(`ℹ Aucun compte ${DEMO_EMAIL} : rien à remettre à zéro.`)
    return
  }
  const userId = user.id
  const cibles = await ciblesDuSchema()
  console.log(`▶ Remise à zéro de ${DEMO_EMAIL} (${cibles.length} tables examinées)${SIMULATION ? " — SIMULATION" : ""}`)

  const avant = new Map<string, number>()
  for (const c of cibles) {
    const n = await compter(c, userId)
    if (n > 0) avant.set(`${c.table}.${c.colonne}`, n)
  }
  if (SIMULATION) {
    for (const [k, n] of [...avant].sort()) console.log(`  · ${k} : ${n}`)
    console.log(`ℹ ${[...avant.values()].reduce((a, b) => a + b, 0)} ligne(s) seraient supprimées.`)
    return
  }

  const { reprises } = await prisma.$transaction((tx) => reprendreReferentielCommunaute(tx, userId))
  if (reprises > 0) console.log(`  ✓ Référentiel partagé repris par la communauté : ${reprises}`)

  let restantes = cibles.filter((c) => avant.has(`${c.table}.${c.colonne}`))
  const echecs = new Map<string, string>()
  for (let passe = 1; restantes.length > 0 && passe <= 12; passe++) {
    const suivantes: Cible[] = []
    for (const c of restantes) {
      try {
        const n = await prisma.$executeRawUnsafe(
          `DELETE FROM ${ident(c.table)} WHERE ${ident(c.colonne)} = $1`,
          userId,
        )
        if (n > 0) console.log(`  ✓ ${c.table} : ${n}`)
        echecs.delete(c.table)
      } catch (err) {
        // Une clé étrangère retient encore la ligne : on retente après les autres.
        echecs.set(c.table, (err as Error).message.split("\n").find((l) => l.trim()) ?? "erreur")
        suivantes.push(c)
      }
    }
    if (suivantes.length === restantes.length) break
    restantes = suivantes
  }

  const residus: string[] = []
  for (const c of cibles) {
    const n = await compter(c, userId)
    if (n > 0) residus.push(`${c.table}.${c.colonne} : ${n}${echecs.has(c.table) ? ` (${echecs.get(c.table)})` : ""}`)
  }
  if (residus.length > 0) {
    console.error("✗ Lignes restantes :\n  " + residus.join("\n  "))
    process.exit(1)
  }
  console.log("✅ Remise à zéro terminée. Lancez `npx tsx prisma/seed-demo.ts`.")
}

main()
  .catch((e) => { console.error("Erreur fatale :", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
