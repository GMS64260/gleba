/**
 * Réparation 2026-08-16 — commandes boutique livrées sans écriture comptable.
 *
 * QA cmsw9bv3s : une commande passée « livrée » sans confirmation de paiement
 * (bouton Enregistrer, PATCH /api/boutique/commandes/[id]) n'appelait jamais
 * confirmCommandeBoutique : ni VenteManuelle, ni fiche client, ni décrément de
 * stock. L'écran Transactions synthétisait pourtant un revenu à partir de la
 * commande orpheline → écart de 3,20 € entre Transactions et les autres écrans
 * (cas CMD-2026-0015 du compte démo).
 *
 * Le code corrigé matérialise désormais la vente à la livraison
 * (livrerCommandeBoutique, paye=false tant que le paiement n'est pas
 * confirmé). Ce script rejoue cette matérialisation pour les commandes
 * livrées AVANT le correctif, avec la même fonction que la production.
 *
 * Usage :
 *   npx tsx --env-file=.env scripts/fix-commandes-livrees-sans-vente-20260816.ts [--apply]
 *
 * Sans `--apply`, n'écrit rien et détaille ce qu'il ferait.
 */

import prisma from "../src/lib/prisma"
import { livrerCommandeBoutique } from "../src/lib/commande-boutique"

const APPLY = process.argv.includes("--apply")

async function main() {
  const orphelines = await prisma.commandeBoutique.findMany({
    where: { statut: "livree", venteManuelleId: null },
    select: {
      id: true,
      userId: true,
      numero: true,
      clientNom: true,
      total: true,
      paiementStatut: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  console.log(`${orphelines.length} commande(s) livrée(s) sans VenteManuelle.`)
  for (const c of orphelines) {
    console.log(
      `- #${c.id} ${c.numero} — ${c.clientNom} — ${c.total} € — paiement ${c.paiementStatut} — user ${c.userId}`
    )
  }

  if (!APPLY) {
    console.log("\nDry-run (aucune écriture). Relancer avec --apply pour réparer.")
    return
  }

  for (const c of orphelines) {
    const result = await prisma.$transaction((tx) => livrerCommandeBoutique(c.id, tx))
    console.log(
      `✔ #${c.id} ${c.numero} → VenteManuelle ${result.venteManuelleId}` +
        (result.stockNegatifs.length
          ? ` (stock négatif : ${result.stockNegatifs.map((s) => s.nom).join(", ")})`
          : "")
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
