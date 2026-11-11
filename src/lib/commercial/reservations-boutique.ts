/**
 * Réservation du stock de la boutique par les commandes en cours.
 *
 * `ProduitBoutique.stockDispo` n'est débité qu'à la sortie de la marchandise
 * (livraison ou paiement confirmé d'une commande, bon de livraison, facture).
 * Entre la commande et cette sortie, rien ne retenait la quantité : deux
 * clients pouvaient commander la dernière unité, et un bon de livraison pouvait
 * sortir ce qu'une commande attendait (revue du 2026-11-11). Plutôt qu'une
 * colonne de plus, la quantité réservée se calcule : c'est la somme des lignes
 * des commandes ni annulées, ni livrées, ni déjà sorties du stock. Elle se
 * libère d'elle-même à l'annulation, et devient un débit réel à la livraison
 * ou au paiement.
 *
 * Toute lecture de « ce qui reste à vendre » passe par ici : commande
 * publique, vitrine, catalogue des documents commerciaux.
 * `stockDispo = null` reste « stock illimité » : rien à réserver.
 */

import type { Prisma } from '@prisma/client'

type Db = Pick<Prisma.TransactionClient, 'ligneCommandeBoutique'>

/** Quantité réservée par produit, pour les produits demandés d'un compte. */
export async function quantitesReservees(
  db: Db,
  userId: string,
  produitIds: number[],
): Promise<Map<number, number>> {
  const reservees = new Map<number, number>()
  if (produitIds.length === 0) return reservees
  const lignes = await db.ligneCommandeBoutique.groupBy({
    by: ['produitId'],
    where: {
      produitId: { in: produitIds },
      commande: {
        userId,
        statut: { notIn: ['annulee', 'livree'] },
        // Une commande matérialisée a déjà débité stockDispo.
        venteManuelleId: null,
        paiementStatut: { not: 'Confirmé' },
      },
    },
    _sum: { quantite: true },
  })
  for (const l of lignes) {
    if (l.produitId !== null) reservees.set(l.produitId, l._sum.quantite ?? 0)
  }
  return reservees
}

/** Ce qui peut encore être vendu ou commandé ; `null` = illimité. */
export function stockCommandable(stockDispo: number | null, reserve: number | undefined): number | null {
  if (stockDispo === null) return null
  return Math.max(0, stockDispo - (reserve ?? 0))
}
