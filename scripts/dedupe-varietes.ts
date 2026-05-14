/**
 * Fusion des variétés doublons via la clé normalisée.
 *
 * Usage :
 *   docker compose exec -T app npx ts-node scripts/dedupe-varietes.ts            # dry-run
 *   docker compose exec -T app npx ts-node scripts/dedupe-varietes.ts --apply    # exécution
 *
 * Stratégie de choix du canonique pour chaque groupe (espece, nom_normalise) :
 *   1. La variété avec le plus de Cultures la référençant (gagne en priorité).
 *   2. Égalité → score de "propreté" du nom (capitalisation, espaces simples).
 *   3. Égalité → ordre alphabétique.
 *
 * Réassignations effectuées avant suppression :
 *   - cultures.variete                       → canonique
 *   - user_stock_varietes.variete_id         → canonique (avec fusion des stocks)
 *
 * lignes_factures n'a PAS de FK vers varietes (texte libre) — rien à migrer.
 */

import { PrismaClient } from "@prisma/client"
import { normalizeVarieteName } from "../src/lib/normalize"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

type Row = { id: string; especeId: string; isPlaceholder: boolean }

function clean(s: string): string {
  return s.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim()
}

// Score de propreté : pénalise les tirets/underscores, espaces multiples,
// casse incohérente. Plus le score est haut, mieux c'est.
function cleanlinessScore(name: string): number {
  let s = 100
  if (/[-_]/.test(name)) s -= 30
  if (/\s{2,}/.test(name)) s -= 20
  if (name !== name.trim()) s -= 10
  // Bonus si la première lettre de chaque mot est en majuscule
  const words = name.split(/\s+/)
  const titled = words.every((w) => w.length === 0 || w[0] === w[0].toUpperCase())
  if (titled) s += 10
  return s
}

async function main() {
  console.log(`[dedupe-varietes] mode=${APPLY ? "APPLY" : "DRY-RUN"}`)

  const all = (await prisma.$queryRaw<Row[]>`
    SELECT variete AS id, espece AS "especeId", is_placeholder AS "isPlaceholder"
    FROM varietes
    ORDER BY espece, variete
  `) as Row[]

  // Group by (especeId, normalized)
  const groups = new Map<string, Row[]>()
  for (const v of all) {
    const k = `${v.especeId}::${normalizeVarieteName(v.id)}`
    const arr = groups.get(k) ?? []
    arr.push(v)
    groups.set(k, arr)
  }

  const duplicates = [...groups.values()].filter((g) => g.length > 1)
  console.log(`[dedupe-varietes] ${duplicates.length} groupe(s) de doublons sur ${all.length} variétés`)

  if (duplicates.length === 0) {
    console.log("[dedupe-varietes] Rien à fusionner.")
    await prisma.$disconnect()
    return
  }

  // Comptage usage Cultures et UserStockVariete par variete.
  const cultureCounts = (await prisma.$queryRaw<{ variete: string; n: bigint }[]>`
    SELECT variete, COUNT(*) AS n
    FROM cultures
    WHERE variete IS NOT NULL
    GROUP BY variete
  `) as { variete: string; n: bigint }[]
  const cultureByVariete = new Map(cultureCounts.map((r) => [r.variete, Number(r.n)]))

  let totalReassignedCultures = 0
  let totalReassignedStocks = 0
  let totalDeleted = 0

  for (const group of duplicates) {
    // Choix du canonique
    const ranked = [...group].sort((a, b) => {
      const cA = cultureByVariete.get(a.id) ?? 0
      const cB = cultureByVariete.get(b.id) ?? 0
      if (cA !== cB) return cB - cA
      const sA = cleanlinessScore(a.id)
      const sB = cleanlinessScore(b.id)
      if (sA !== sB) return sB - sA
      return a.id.localeCompare(b.id)
    })
    const canonical = ranked[0]
    const doublons = ranked.slice(1)
    const cleanedCanonicalId = clean(canonical.id)

    console.log(
      `\n  [${canonical.especeId}] canonique = "${canonical.id}"` +
        (cleanedCanonicalId !== canonical.id ? ` → renommé "${cleanedCanonicalId}"` : "")
    )
    for (const d of doublons) {
      const nCult = cultureByVariete.get(d.id) ?? 0
      console.log(`    × "${d.id}"  (${nCult} culture(s))`)
    }

    if (!APPLY) continue

    // Renommage éventuel du canonique pour adopter la forme propre.
    // ON UPDATE CASCADE sur cultures/user_stock_varietes propage la PK.
    if (cleanedCanonicalId !== canonical.id) {
      const collision = await prisma.variete.findUnique({ where: { id: cleanedCanonicalId } })
      if (!collision) {
        await prisma.$executeRaw`UPDATE varietes SET variete = ${cleanedCanonicalId} WHERE variete = ${canonical.id}`
        canonical.id = cleanedCanonicalId
      } else {
        console.log(
          `    ⚠ Renommage impossible : "${cleanedCanonicalId}" existe déjà. On garde "${canonical.id}".`
        )
      }
    }

    for (const d of doublons) {
      // 1) cultures.variete → canonical
      const r1 = await prisma.$executeRaw`UPDATE cultures SET variete = ${canonical.id} WHERE variete = ${d.id}`
      totalReassignedCultures += Number(r1)

      // 2) user_stock_varietes : fusion si déjà un stock canonique pour ce user
      const stocksDuplicate = (await prisma.$queryRaw<
        { id: number; user_id: string; stock_graines: number | null; stock_plants: number | null }[]
      >`
        SELECT id, user_id, stock_graines, stock_plants
        FROM user_stock_varietes
        WHERE variete_id = ${d.id}
      `) as { id: number; user_id: string; stock_graines: number | null; stock_plants: number | null }[]

      for (const s of stocksDuplicate) {
        const target = (await prisma.$queryRaw<{ id: number }[]>`
          SELECT id FROM user_stock_varietes
          WHERE user_id = ${s.user_id} AND variete_id = ${canonical.id}
          LIMIT 1
        `) as { id: number }[]

        if (target.length > 0) {
          await prisma.$executeRaw`
            UPDATE user_stock_varietes
            SET stock_graines = COALESCE(stock_graines, 0) + ${s.stock_graines ?? 0},
                stock_plants = COALESCE(stock_plants, 0) + ${s.stock_plants ?? 0}
            WHERE id = ${target[0].id}
          `
          await prisma.$executeRaw`DELETE FROM user_stock_varietes WHERE id = ${s.id}`
        } else {
          await prisma.$executeRaw`UPDATE user_stock_varietes SET variete_id = ${canonical.id} WHERE id = ${s.id}`
        }
        totalReassignedStocks += 1
      }

      // 3) suppression du doublon
      await prisma.$executeRaw`DELETE FROM varietes WHERE variete = ${d.id}`
      totalDeleted += 1
    }
  }

  // Recalcule nom_normalise (au cas où des renommages ont eu lieu)
  if (APPLY) {
    const everyone = (await prisma.$queryRaw<{ id: string }[]>`SELECT variete AS id FROM varietes`) as {
      id: string
    }[]
    for (const v of everyone) {
      await prisma.$executeRaw`UPDATE varietes SET nom_normalise = ${normalizeVarieteName(v.id)} WHERE variete = ${v.id}`
    }
    console.log(`\n[dedupe-varietes] nom_normalise recalculé pour ${everyone.length} variété(s)`)
  }

  console.log(`\n[dedupe-varietes] ${APPLY ? "APPLIQUÉ" : "DRY-RUN"} :`)
  console.log(`  - cultures réassignées : ${totalReassignedCultures}`)
  console.log(`  - user_stock_varietes réassignés/fusionnés : ${totalReassignedStocks}`)
  console.log(`  - variétés supprimées : ${totalDeleted}`)

  if (!APPLY) console.log("\nRelance avec --apply pour exécuter réellement.")

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
