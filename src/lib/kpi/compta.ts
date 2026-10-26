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

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import type { ModuleCompta } from '@/lib/comptabilite/modules'
import {
  moduleDesVentesPortees,
  ventilerRevenus,
  type VentilationRevenus,
} from '@/lib/comptabilite/ventilation-revenus'
import type { KPICompta } from './types'
import { shiftToPrevYear } from './types'
import { asOfDayKey, memoize } from './cache'

/**
 * Périmètre des revenus : toutes les ventes (saisies, miroirs automatiques,
 * ventes boutique) datées dans la période. Partagé par le total et par sa
 * ventilation par module.
 */
export function whereVentesRevenus(userId: string, debut: Date, fin: Date): Prisma.VenteManuelleWhereInput {
  return { userId, date: { gte: debut, lte: fin } }
}

/**
 * Statuts d'une facture qui n'est pas (ou plus) une vente : ni comptée dans les
 * revenus, ni au compteur de ventes d'un client (`compterVentesParClient`).
 */
export const STATUTS_FACTURE_HORS_VENTES = ['annulee', 'brouillon']

/** Factures comptées dans les revenus : ni brouillon ni annulée ; un avoir se déduit. */
export function whereFacturesRevenus(userId: string, debut: Date, fin: Date): Prisma.FactureWhereInput {
  return { userId, date: { gte: debut, lte: fin }, statut: { notIn: STATUTS_FACTURE_HORS_VENTES } }
}

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
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)
  const startOfYearN1 = new Date(year - 1, 0, 1, 0, 0, 0, 0)
  const endOfYearN1 = new Date(year - 1, 11, 31, 23, 59, 59, 999)
  // Ticket DEV2 #1 — Borne haute "YTD" : pour l'année passée, on lit
  // l'année entière. Sinon une sélection 2024 retournait tout depuis
  // 2024 jusqu'à `now`.
  const isCurrentYear = asOf.getFullYear() === year
  const upperBound = isCurrentYear ? asOf : endOfYear
  const asOfN1 = isCurrentYear ? shiftToPrevYear(asOf) : endOfYearN1

  // ============================================================
  // REVENUS : VenteManuelle + LigneFacture (factures non annulées)
  // ============================================================
  // Ticket cmvflua2x (2026-10-19) : les revenus de l'exercice sont lus ligne à
  // ligne et ventilés par module dans le même calcul ; le total exposé est la
  // somme de cette ventilation, qui ne peut donc plus s'en écarter.
  const [
    ventilationYtd,
    venteN1Ytd,
    venteN1Total,
    factureN1Ytd,
    factureN1Total,
  ] = await Promise.all([
    chargerVentilationRevenus(userId, startOfYear, upperBound),
    sumVenteManuelle(userId, startOfYearN1, asOfN1),
    sumVenteManuelle(userId, startOfYearN1, endOfYearN1),
    sumLigneFacture(userId, startOfYearN1, asOfN1),
    sumLigneFacture(userId, startOfYearN1, endOfYearN1),
  ])

  const revenusYtd = ventilationYtd.total
  const revenusN1Ytd = venteN1Ytd + factureN1Ytd
  const revenusN1Total = venteN1Total + factureN1Total

  // ============================================================
  // DÉPENSES : DepenseManuelle
  // ============================================================
  const [
    depenseYtd,
    depenseN1Ytd,
    depenseN1Total,
    depensesNonPayees,
    revenusNonPayes,
  ] = await Promise.all([
    sumDepenseManuelle(userId, startOfYear, upperBound),
    sumDepenseManuelle(userId, startOfYearN1, asOfN1),
    sumDepenseManuelle(userId, startOfYearN1, endOfYearN1),
    // BUG #2 — sous-totaux non payés (info, pas un filtre)
    prisma.depenseManuelle.aggregate({
      where: { userId, date: { gte: startOfYear, lte: upperBound }, paye: false, comptable: true },
      _sum: { montant: true },
      _count: true,
    }),
    prisma.venteManuelle.aggregate({
      where: { userId, date: { gte: startOfYear, lte: upperBound }, paye: false },
      _sum: { montant: true },
      _count: true,
    }),
  ])

  const beneficeYtd = revenusYtd - depenseYtd
  const margePercentYtd = revenusYtd > 0 ? (beneficeYtd / revenusYtd) * 100 : 0

  return {
    year,
    asOf,
    revenusYtd: round2(revenusYtd),
    revenusParModuleYtd: ventilationYtd,
    revenusN1Ytd: round2(revenusN1Ytd),
    revenusN1Total: round2(revenusN1Total),
    depensesYtd: round2(depenseYtd),
    depensesN1Ytd: round2(depenseN1Ytd),
    depensesN1Total: round2(depenseN1Total),
    beneficeYtd: round2(beneficeYtd),
    margePercentYtd: round2(margePercentYtd),
    depensesNonPayeesYtd: round2(depensesNonPayees._sum.montant ?? 0),
    nbDepensesNonPayees: depensesNonPayees._count,
    revenusNonPayesYtd: round2(revenusNonPayes._sum.montant ?? 0),
    nbRevenusNonPayes: revenusNonPayes._count,
  }
}

async function sumVenteManuelle(
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const r = await prisma.venteManuelle.aggregate({
    where: whereVentesRevenus(userId, start, end),
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
    where: { userId, date: { gte: start, lte: end }, comptable: true },
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
    where: whereFacturesRevenus(userId, start, end),
    select: { type: true, totalTTC: true },
  })

  let total = 0
  for (const f of factures) {
    const signe = f.type === 'avoir' ? -1 : 1
    total += signe * f.totalTTC
  }
  return total
}

/** Ventes métier qu'une facture peut porter (relations de `Facture`). */
const VENTES_PORTEES = {
  ventesProduits: true,
  abattages: true,
  recoltesArbres: true,
  productionsBois: true,
  commandesBoutique: true,
} as const

/**
 * Revenus de la période, ligne à ligne, ventilés par module : mêmes ventes et
 * mêmes factures que `sumVenteManuelle` + `sumLigneFacture`. Une facture prend
 * le module de la vente métier qu'elle porte, un avoir celui de sa facture
 * d'origine, une facture saisie sans vente va en « Autre ».
 */
export async function chargerVentilationRevenus(userId: string, debut: Date, fin: Date): Promise<VentilationRevenus> {
  const [ventes, factures] = await Promise.all([
    prisma.venteManuelle.findMany({
      where: whereVentesRevenus(userId, debut, fin),
      select: { montant: true, module: true, categorie: true },
    }),
    prisma.facture.findMany({
      where: whereFacturesRevenus(userId, debut, fin),
      select: { id: true, type: true, totalTTC: true, factureOrigineId: true, lignes: { select: { articleStockType: true } }, _count: { select: VENTES_PORTEES } },
    }),
  ])

  // Un avoir suit sa facture d'origine, qui peut dater d'un exercice antérieur.
  const chargees = new Set(factures.map((f) => f.id))
  const originesManquantes = [
    ...new Set(
      factures
        .filter((f) => f.type === 'avoir' && f.factureOrigineId != null && !chargees.has(f.factureOrigineId))
        .map((f) => f.factureOrigineId as number),
    ),
  ]
  const origines = originesManquantes.length
    ? await prisma.facture.findMany({
        where: { userId, id: { in: originesManquantes } },
        select: { id: true, lignes: { select: { articleStockType: true } }, _count: { select: VENTES_PORTEES } },
      })
    : []

  // Les récoltes du potager portent `factureId` sans relation Prisma.
  const ids = [...factures.map((f) => f.id), ...origines.map((o) => o.id)].filter((id): id is number => id != null)
  const recoltes = ids.length
    ? await prisma.recolte.findMany({ where: { userId, factureId: { in: ids } }, select: { factureId: true } })
    : []
  const recoltesParFacture = new Map<number, number>()
  for (const r of recoltes) {
    if (r.factureId != null) recoltesParFacture.set(r.factureId, (recoltesParFacture.get(r.factureId) ?? 0) + 1)
  }

  const moduleParFacture = new Map<number, ModuleCompta | null>()
  for (const f of [...factures, ...origines]) {
    const modulesStock = [...new Set(f.lignes.filter((l) => l.articleStockType).map((l): ModuleCompta => l.articleStockType === 'recolte' ? 'potager' : ['fruit', 'bois'].includes(l.articleStockType!) ? 'verger' : ['oeufs', 'ruche', 'fromage'].includes(l.articleStockType!) ? 'elevage' : 'autre'))]
    if (modulesStock.length) { moduleParFacture.set(f.id, modulesStock.length === 1 ? modulesStock[0] : 'autre'); continue }
    moduleParFacture.set(f.id, moduleDesVentesPortees({ ...f._count, recoltes: recoltesParFacture.get(f.id) ?? 0 }))
  }

  return ventilerRevenus(
    ventes,
    factures.map((f) => ({
      type: f.type,
      totalTTC: f.totalTTC,
      moduleSource:
        f.type === 'avoir'
          ? f.factureOrigineId != null ? moduleParFacture.get(f.factureOrigineId) ?? null : null
          : moduleParFacture.get(f.id) ?? null,
    })),
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
