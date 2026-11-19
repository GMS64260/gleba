import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { deviseCouranteExploitation } from '@/lib/comptabilite/devise-reglement'
import { projeterVentesFromage, type PeriodeVentesFromage } from './economie-lait-ventes'

/** Lecteur commun à Économie du lait, Cave et Comptabilité > Stocks.
 * Les liens techniques de facture ne sont retenus que pour les lots du tenant.
 */
export async function chargerVentesFromage(userId: string, periode?: PeriodeVentesFromage, options: { lotIds?: string[]; valorisation?: boolean } = {}) {
  // Une facturation concurrente ne peut être lue entre la vente native et sa pièce.
  return prisma.$transaction(tx => lireVentesFromage(tx, userId, periode, options), { isolationLevel: 'RepeatableRead' })
}

async function lireVentesFromage(db: Prisma.TransactionClient, userId: string, periode: PeriodeVentesFromage | undefined, options: { lotIds?: string[]; valorisation?: boolean }) {
  const lots = await db.lotFromage.findMany({ where: { userId, ...(options.lotIds ? { id: { in: options.lotIds } } : {}) }, select: { id: true, typeFromage: true, nbPieces: true, poidsTotalKg: true } })
  if (!lots.length) return []
  const ids = lots.map(l => l.id)
  const lienFromage = { articleStockType: 'fromage', articleStockId: { in: ids } }
  const lienAtelier = { userId, lotFromageId: { in: ids } }
  const [atelier, mouvements, factures, exploitation] = await Promise.all([
    db.venteProduit.findMany({ where: lienAtelier, select: { id: true, lotFromageId: true, date: true, annule: true, factureId: true, quantite: true, unite: true, prixTotal: true,
      mouvementsFromage: { where: { userId }, select: { poidsKg: true } } } }),
    db.mouvementStockCommercial.findMany({
      where: { userId, fromageId: { in: ids }, nature: { in: ['livraison', 'retour'] },
        OR: [{ document: { userId } }, { facture: { userId } }] },
      select: { id: true, fromageId: true, date: true, quantite: true, unite: true, poidsKg: true, factureId: true, documentId: true,
        facture: { select: { userId: true } }, document: { select: { userId: true, factureId: true, facture: { select: { userId: true } } } } },
    }),
    db.facture.findMany({ where: { userId, OR: [
      { lignes: { some: lienFromage } },
      { ventesProduits: { some: lienAtelier } },
      { factureOrigineRef: { userId, OR: [{ lignes: { some: lienFromage } }, { ventesProduits: { some: lienAtelier } }] } },
    ] }, select: { id: true, type: true, statut: true, date: true, factureOrigineId: true, totalTTC: true, emetteurSnapshot: true,
      ventesProduits: { where: { userId }, select: { lotFromageId: true, unite: true, quantite: true, prixTotal: true } },
      lignes: { select: { articleStockType: true, articleStockId: true, unite: true, quantite: true, montantTTC: true } } } }),
    db.exploitation.findUnique({ where: { userId }, select: { devise: true, territoire: true } }),
  ])
  return projeterVentesFromage({
    lots: lots.map(l => ({ ...l, poidsTotalKg: Number(l.poidsTotalKg) })),
    atelier: atelier.flatMap(v => v.lotFromageId == null ? [] : [{ ...v, lotFromageId: v.lotFromageId, poidsKg: v.mouvementsFromage.reduce((s, m) => s + Number(m.poidsKg), 0) }]),
    mouvements: mouvements.flatMap(m => m.fromageId == null ? [] : [{ ...m, lotFromageId: m.fromageId,
      factureId: m.facture?.userId === userId ? m.factureId : m.document?.userId === userId && m.document.facture?.userId === userId ? m.document.factureId : null }]),
    factures: factures.map(f => ({ ...f, ventesAtelier: f.ventesProduits })),
  }, deviseCouranteExploitation(exploitation), periode, options.valorisation)
}
