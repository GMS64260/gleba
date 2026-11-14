/**
 * Récoltes potager vendues que les lecteurs comptables réinjectent comme
 * recettes (FEC, TVA et aide CA3) : source unique de leur périmètre.
 *
 * BL-01 (revue du 2026-11-11) : jusqu'au 2026-11-12, une commande de boutique
 * qui épuisait un produit passait la récolte liée à « vendu » sans écriture
 * propre (la recette est portée par la `VenteManuelle` de la commande). Le FEC
 * et la TVA relisaient ensuite cette récolte comme une vente à part : un lot de
 * 10 kg à 4 €/kg vendu en deux commandes de 20 € sortait 80 € au FEC et à la
 * CA3, contre 40 € au chiffre d'affaires.
 *
 * Règle : une récolte vendue par sa propre fiche porte toujours un miroir
 * (`VenteManuelle` auto, `sourceType = 'recolte'`), que le chiffre d'affaires
 * compte. Une récolte « vendue », liée à un produit de boutique et SANS miroir
 * a été soldée par des commandes : sa recette est déjà celle des commandes, le
 * chiffre d'affaires ne la compte pas, le FEC et la TVA non plus.
 *
 * Limite connue : le lien `ProduitBoutique.recolteId` disparaît avec le
 * produit. Une récolte ancienne dont le produit a été supprimé n'est plus
 * reconnaissable ici ; sa reprise est une décision de données (Guillaume).
 */

import type { Prisma, PrismaClient } from '@prisma/client'

type Lecteur = Prisma.TransactionClient | PrismaClient

export interface RecolteVendueReinjectee {
  id: number
  especeId: string
  date: Date
  dateVente: Date | null
  quantite: number
  prixKg: number | null
  prixTotal: number | null
  clientNom: string | null
}

export async function chargerRecoltesVenduesReinjectees(
  db: Lecteur,
  userId: string,
  debut: Date,
  fin: Date,
): Promise<RecolteVendueReinjectee[]> {
  const recoltes = await db.recolte.findMany({
    where: {
      userId,
      statut: 'vendu',
      dateVente: { gte: debut, lte: fin },
      OR: [{ prixTotal: { not: null } }, { prixKg: { not: null } }],
      factureId: null,
    },
    select: {
      id: true, especeId: true, date: true, dateVente: true, quantite: true,
      prixKg: true, prixTotal: true, clientNom: true,
      // Scopé au compte : un produit d'une autre exploitation ne retire rien.
      produitsBoutique: { where: { userId }, select: { id: true }, take: 1 },
    },
    orderBy: [{ dateVente: 'asc' }, { id: 'asc' }],
  })
  const lieeBoutique = (r: (typeof recoltes)[number]) => (r.produitsBoutique?.length ?? 0) > 0
  const lieesBoutique = recoltes.filter(lieeBoutique).map((r) => r.id)
  const avecMiroir = new Set<number>()
  if (lieesBoutique.length) {
    const miroirs = await db.venteManuelle.findMany({
      where: { userId, auto: true, sourceType: 'recolte', sourceId: { in: lieesBoutique } },
      select: { sourceId: true },
    })
    for (const m of miroirs) if (m.sourceId != null) avecMiroir.add(m.sourceId)
  }
  return recoltes
    .filter((r) => !lieeBoutique(r) || avecMiroir.has(r.id))
    .map((r) => ({
      id: r.id, especeId: r.especeId, date: r.date, dateVente: r.dateVente, quantite: r.quantite,
      prixKg: r.prixKg, prixTotal: r.prixTotal, clientNom: r.clientNom,
    }))
}
