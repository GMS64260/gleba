/**
 * scripts/dedupe-boutique-transactions.ts
 *
 * DEV1 Ticket 3 (audit QA 2026-05-14) : double comptage des commandes
 * boutique dans /comptabilite/transactions. Deux causes identifiées :
 *
 *   1. /api/comptabilite/revenus listait à la fois VenteManuelle et
 *      CommandeBoutique pour chaque commande livrée (corrigé dans le code).
 *
 *   2. Le seed-demo.ts avec override DEMO_EMAIL_OVERRIDE clone les
 *      commandes avec un suffixe `-${userId.slice(-4)}` (CMD-2026-0001 +
 *      CMD-2026-0001-2026). Chaque clone crée sa propre VenteManuelle.
 *
 * Ce script nettoie le cas 2 : supprime les commandes "clones" (suffixe
 * -NNNN après un numéro de commande déjà existant) et leurs VenteManuelle
 * associées (lien sourceType='commande_boutique', sourceId=cmd.id).
 *
 * Usage :
 *   npx tsx scripts/dedupe-boutique-transactions.ts            # dry-run (par défaut)
 *   npx tsx scripts/dedupe-boutique-transactions.ts --apply    # applique réellement
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const APPLY = process.argv.includes("--apply")

// Regex : "CMD-2026-0001-2026" → matche, capture "CMD-2026-0001" et "-2026"
const CLONE_PATTERN = /^(CMD-\d{4}-\d{4})(-[A-Za-z0-9]{4})$/

async function main() {
  console.log(`\n=== dedupe-boutique-transactions (${APPLY ? "APPLY" : "DRY-RUN"}) ===\n`)

  // 1) Identifier les commandes "clones"
  const all = await prisma.commandeBoutique.findMany({
    select: { id: true, userId: true, numero: true, total: true, venteManuelleId: true },
  })
  console.log(`Commandes totales : ${all.length}`)

  const cloned: typeof all = []
  for (const cmd of all) {
    const match = cmd.numero.match(CLONE_PATTERN)
    if (!match) continue
    // Vérifier qu'une commande "originale" existe bien chez le même user
    const original = all.find(
      (c) => c.userId === cmd.userId && c.numero === match[1]
    )
    if (!original) continue // pas un clone, c'est l'original lui-même
    cloned.push(cmd)
  }
  console.log(`Commandes clones identifiées : ${cloned.length}`)

  if (cloned.length === 0) {
    console.log("Rien à nettoyer.")
    return
  }

  for (const c of cloned.slice(0, 10)) {
    console.log(`  - ${c.numero} (id=${c.id}, total=${c.total} €)`)
  }
  if (cloned.length > 10) console.log(`  ... +${cloned.length - 10} autres`)

  // 2) Lister les VenteManuelle liées
  const cloneIds = cloned.map((c) => c.id)
  const ventesLiees = await prisma.venteManuelle.findMany({
    where: {
      sourceType: "commande_boutique",
      sourceId: { in: cloneIds },
    },
    select: { id: true, sourceId: true, montant: true, date: true },
  })
  console.log(`\nVenteManuelle liées à supprimer : ${ventesLiees.length}`)
  const totalAEffacer = ventesLiees.reduce((s, v) => s + (v.montant || 0), 0)
  console.log(`Montant cumulé : ${totalAEffacer.toFixed(2)} €`)

  if (!APPLY) {
    console.log("\n→ DRY-RUN terminé. Ajouter --apply pour appliquer.")
    return
  }

  // 3) Appliquer
  await prisma.$transaction(async (tx) => {
    // 3a) Supprimer les VenteManuelle (cascade nécessite pas)
    if (ventesLiees.length > 0) {
      await tx.venteManuelle.deleteMany({
        where: {
          sourceType: "commande_boutique",
          sourceId: { in: cloneIds },
        },
      })
    }
    // 3b) Supprimer les commandes clones (cascade DELETE sur lignes_commande_boutique)
    await tx.commandeBoutique.deleteMany({
      where: { id: { in: cloneIds } },
    })
  })

  console.log(`\n✅ Nettoyé : ${cloned.length} commandes + ${ventesLiees.length} ventes manuelles supprimées.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
