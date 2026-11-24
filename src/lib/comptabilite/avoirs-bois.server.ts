/**
 * Avoirs qui corrigent une vente de bois facturée, lus une seule fois pour
 * toutes les surfaces qui affichent un chiffre d'affaires du bois (part
 * « Bois » des Rapports, tuile du verger, carte « CA Ventes » des
 * productions). Avant, seule la part des Rapports les déduisait : une vente
 * de 500 € suivie d'un avoir de 100 € restait à 500 € dans le verger
 * (FB-6Y9GPS).
 *
 * Règle de montant : `montantBoisAvoir` (lignes liées à du bois, lignes
 * libres seulement si la facture d'origine ne porte que du bois).
 */
import prisma from '@/lib/prisma'
import { STATUTS_FACTURE_HORS_VENTES } from '@/lib/kpi/compta'
import { monnaieFacture } from '@/lib/comptabilite/devise-reglement'
import { montantBoisAvoir } from '@/lib/comptabilite/avoirs-bois'
import type { Devise } from '@/lib/territoires'

export interface AvoirBoisCharge {
  factureOrigineId: number | null
  /** Montant TTC à déduire du chiffre d'affaires du bois (positif). */
  montant: number
  monnaie: Devise | null
}

export async function chargerAvoirsBois(
  userId: string,
  filtre: { date?: { gte?: Date; lte?: Date; lt?: Date }; factureOrigineIds?: number[] },
): Promise<AvoirBoisCharge[]> {
  if (filtre.factureOrigineIds && filtre.factureOrigineIds.length === 0) return []
  const avoirs = await prisma.facture.findMany({
    where: {
      userId, type: 'avoir', statut: { notIn: STATUTS_FACTURE_HORS_VENTES },
      ...(filtre.date ? { date: filtre.date } : {}),
      ...(filtre.factureOrigineIds ? { factureOrigineId: { in: filtre.factureOrigineIds } } : {}),
      factureOrigineRef: { productionsBois: { some: {} } },
    },
    select: {
      factureOrigineId: true, totalTTC: true, date: true, emetteurSnapshot: true,
      lignes: { select: { montantTTC: true, articleStockType: true } },
      factureOrigineRef: { select: {
        lignes: { select: { articleStockType: true } },
        _count: { select: { ventesProduits: true, abattages: true, recoltesArbres: true, commandesBoutique: true } },
      } },
    },
  })
  return avoirs.map((a) => {
    const origine = a.factureOrigineRef
    const origineToutBois = !!origine
      && Object.values(origine._count).every((n) => n === 0)
      && origine.lignes.every((l) => !l.articleStockType || l.articleStockType === 'bois')
    return {
      factureOrigineId: a.factureOrigineId,
      montant: montantBoisAvoir({ totalTTC: a.totalTTC, lignes: a.lignes, origineToutBois }),
      monnaie: monnaieFacture(a.emetteurSnapshot, a.date),
    }
  }).filter((a) => a.montant !== 0)
}
