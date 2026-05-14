/**
 * Backfill : assigner la variété placeholder "Non spécifiée" aux cultures
 * historiques dont varieteId IS NULL.
 *
 * Usage :
 *   docker compose exec -T app npx ts-node scripts/backfill-cultures-placeholders.ts            # dry-run
 *   docker compose exec -T app npx ts-node scripts/backfill-cultures-placeholders.ts --apply    # exécution
 *
 * Crée un placeholder par espèce concernée (avec isPlaceholder=true)
 * puis met à jour cultures.variete = placeholderId.
 * L'UI affichera un bandeau "À renseigner" sur ces cultures.
 */

import { PrismaClient } from "@prisma/client"
import { ensurePlaceholderVariete } from "../src/lib/varietes"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

async function main() {
  console.log(`[backfill-cultures-placeholders] mode=${APPLY ? "APPLY" : "DRY-RUN"}`)

  const byEspece = (await prisma.$queryRaw<{ espece: string; n: bigint }[]>`
    SELECT espece, COUNT(*) AS n
    FROM cultures
    WHERE variete IS NULL
    GROUP BY espece
    ORDER BY n DESC
  `) as { espece: string; n: bigint }[]

  if (byEspece.length === 0) {
    console.log("[backfill-cultures-placeholders] Aucune culture sans variete — rien à faire.")
    await prisma.$disconnect()
    return
  }

  console.log(
    `[backfill-cultures-placeholders] ${byEspece.length} espèce(s) avec cultures sans variété :`
  )
  for (const row of byEspece) {
    console.log(`  - ${row.espece} : ${Number(row.n)} culture(s)`)
  }

  if (!APPLY) {
    console.log("\nRelance avec --apply pour exécuter réellement.")
    await prisma.$disconnect()
    return
  }

  let totalUpdated = 0
  for (const row of byEspece) {
    const placeholderId = await ensurePlaceholderVariete(row.espece)
    const result = await prisma.$executeRaw`
      UPDATE cultures SET variete = ${placeholderId}
      WHERE espece = ${row.espece} AND variete IS NULL
    `
    totalUpdated += Number(result)
    console.log(`  ✓ ${row.espece} → placeholder "${placeholderId}" : ${Number(result)} culture(s)`)
  }

  console.log(`\n[backfill-cultures-placeholders] ${totalUpdated} culture(s) mises à jour.`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
