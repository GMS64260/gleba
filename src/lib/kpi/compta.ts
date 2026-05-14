/**
 * KPI Comptabilité — source unique de vérité.
 *
 * Postulat d'architecture (cf PROMPT 04) : il existe UNE seule source par poste.
 *
 *   Revenus   = Σ(VenteManuelle.montant) + Σ(LigneFacture.montantTTC pour
 *               factures non annulées)
 *   Dépenses  = Σ(DepenseManuelle.montant)
 *
 * Conséquences pour le reste de l'application :
 *   1. Les autres modules (récoltes potager vendues, ventes élevage, abattages,
 *      production bois, etc.) doivent obligatoirement produire une
 *      `VenteManuelle` "auto" via `src/lib/auto-compta.ts` pour être comptés.
 *      C'est déjà le cas — la couche KPI s'appuie sur ce contrat.
 *   2. Aucun autre code ne doit additionner des transactions hors de cette
 *      couche. Tout `prisma.X.aggregate({_sum: { ... }})` portant sur des
 *      revenus/dépenses doit être remplacé par `getKpiCompta`.
 *   3. Si une vente est facturée (`LigneFacture`), elle ne doit PAS également
 *      faire l'objet d'une saisie manuelle dans VenteManuelle, sous peine de
 *      double comptage.
 */

import prisma from '@/lib/prisma'
import type { KPICompta } from './types'
import { shiftToPrevYear } from './types'
import { asOfDayKey, memoize } from './cache'

export async function getKpiCompta(
  userId: string,
  year: number,
  asOf: Date = new Date()
): Promise<KPICompta> {
  const key = `compta:${userId}:${year}:${asOfDayKey(asOf)}`
  return memoize(key, () => computeKpiCompta(userId, year, asOf))
}

async function computeKpiCompta(
  userId: string,
  year: number,
  asOf: Date
): Promise<KPICompta> {
  const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0)
  const startOfYearN1 = new Date(year - 1, 0, 1, 0, 0, 0, 0)
  const endOfYearN1 = new Date(year - 1, 11, 31, 23, 59, 59, 999)
  const asOfN1 = shiftToPrevYear(asOf)

  // ============================================================
  // REVENUS : VenteManuelle + LigneFacture (factures non annulées)
  // ============================================================
  const [
    venteYtd,
    venteN1Ytd,
    venteN1Total,
    factureYtd,
    factureN1Ytd,
    factureN1Total,
  ] = await Promise.all([
    sumVenteManuelle(userId, startOfYear, asOf),
    sumVenteManuelle(userId, startOfYearN1, asOfN1),
    sumVenteManuelle(userId, startOfYearN1, endOfYearN1),
    sumLigneFacture(userId, startOfYear, asOf),
    sumLigneFacture(userId, startOfYearN1, asOfN1),
    sumLigneFacture(userId, startOfYearN1, endOfYearN1),
  ])

  const revenusYtd = venteYtd + factureYtd
  const revenusN1Ytd = venteN1Ytd + factureN1Ytd
  const revenusN1Total = venteN1Total + factureN1Total

  // ============================================================
  // DÉPENSES : DepenseManuelle
  // ============================================================
  const [depenseYtd, depenseN1Ytd, depenseN1Total] = await Promise.all([
    sumDepenseManuelle(userId, startOfYear, asOf),
    sumDepenseManuelle(userId, startOfYearN1, asOfN1),
    sumDepenseManuelle(userId, startOfYearN1, endOfYearN1),
  ])

  const beneficeYtd = revenusYtd - depenseYtd
  const margePercentYtd = revenusYtd > 0 ? (beneficeYtd / revenusYtd) * 100 : 0

  return {
    year,
    asOf,
    revenusYtd: round2(revenusYtd),
    revenusN1Ytd: round2(revenusN1Ytd),
    revenusN1Total: round2(revenusN1Total),
    depensesYtd: round2(depenseYtd),
    depensesN1Ytd: round2(depenseN1Ytd),
    depensesN1Total: round2(depenseN1Total),
    beneficeYtd: round2(beneficeYtd),
    margePercentYtd: round2(margePercentYtd),
  }
}

async function sumVenteManuelle(
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const r = await prisma.venteManuelle.aggregate({
    where: { userId, date: { gte: start, lte: end } },
    _sum: { montant: true },
  })
  return r._sum.montant ?? 0
}

async function sumDepenseManuelle(
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const r = await prisma.depenseManuelle.aggregate({
    where: { userId, date: { gte: start, lte: end } },
    _sum: { montant: true },
  })
  return r._sum.montant ?? 0
}

/**
 * Somme les lignes des factures émises et payées (statut ≠ 'annulee',
 * 'brouillon') sur la période. Les avoirs (`type='avoir'`) sont soustraits.
 */
async function sumLigneFacture(
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const factures = await prisma.facture.findMany({
    where: {
      userId,
      date: { gte: start, lte: end },
      statut: { notIn: ['annulee', 'brouillon'] },
    },
    select: { type: true, totalTTC: true },
  })

  let total = 0
  for (const f of factures) {
    const signe = f.type === 'avoir' ? -1 : 1
    total += signe * f.totalTTC
  }
  return total
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
