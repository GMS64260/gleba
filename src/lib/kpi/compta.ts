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
import { chargerEncoursCompta } from '@/lib/comptabilite/encours'
import type { ModuleCompta } from '@/lib/comptabilite/modules'
import {
  moduleDesVentesPortees,
  ventilerRevenusParDevise,
  type VentilationRevenus,
} from '@/lib/comptabilite/ventilation-revenus'
import { deviseCouranteExploitation, monnaieFacture } from '@/lib/comptabilite/devise-reglement'
import { monnaieVente, SELECT_CONTEXTE_FISCAL_VENTE } from '@/lib/comptabilite/devise-vente'
import { monnaieImpayee } from '@/lib/comptabilite/ventilation-impayees'
import { sommerParDevise, soustraireParDevise, totalSiUneDevise, margeParDevise, verifierDeviseCalcul, ErreurDevisesIncompatibles, type TotalDevise } from '@/lib/comptabilite/totaux-devise'
import { chargerMonnaiesDepenses, SELECT_IDENTITE_DEPENSE } from '@/lib/comptabilite/devise-ecritures'
import type { Devise } from '@/lib/territoires'
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
 * Périmètre des dépenses : les seules charges comptables. Les coûts analytiques
 * internes (`comptable: false` : soins, consommations d'aliments…) en sont
 * exclus. Partagé par le total et par sa ventilation mensuelle.
 */
export function whereDepensesComptables(userId: string, debut: Date, fin: Date): Prisma.DepenseManuelleWhereInput {
  return { userId, date: { gte: debut, lte: fin }, comptable: true }
}

/**
 * Bornes de l'exercice lu par les KPI. Ticket DEV2 #1 — pour l'année en cours,
 * on s'arrête à `asOf` ; pour une année passée, on lit l'année entière.
 */
export function bornesExerciceKpi(year: number, asOf: Date): { debut: Date; fin: Date } {
  const debut = new Date(year, 0, 1, 0, 0, 0, 0)
  const finAnnee = new Date(year, 11, 31, 23, 59, 59, 999)
  return { debut, fin: asOf.getFullYear() === year ? asOf : finAnnee }
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

/** Lecteurs historiques : contrat numérique, refus explicite si les devises sont incompatibles. */
type KPIComptaMonoDevise = { [K in keyof KPICompta]: NonNullable<KPICompta[K]> }
export function getKpiCompta(userId: string, year: number, asOf: Date, options: { parDevise: true }): Promise<KPICompta>
export function getKpiCompta(userId: string, year: number, asOf?: Date): Promise<KPIComptaMonoDevise>
export async function getKpiCompta(
  userId: string,
  year: number,
  asOf: Date = new Date(),
  options?: { parDevise: true },
): Promise<KPICompta> {
  const exploitation = await prisma.exploitation.findUnique({ where: { userId }, select: { devise: true, territoire: true } })
  const deviseCourante = deviseCouranteExploitation(exploitation)
  // La devise courante est une entrée du calcul des écritures non figées.
  const key = `compta:${userId}:${year}:${asOfDayKey(asOf)}:${deviseCourante}`
  const kpi = await memoize(key, () => computeKpiCompta(userId, year, asOf, deviseCourante))
  if (!options?.parDevise) {
    verifierDeviseCalcul(kpi.deviseCourante,
      kpi.revenusYtdParDevise, kpi.depensesYtdParDevise, kpi.revenusN1YtdParDevise, kpi.revenusN1TotalParDevise,
      kpi.depensesN1YtdParDevise, kpi.depensesN1TotalParDevise, kpi.revenusNonPayesYtdParDevise, kpi.depensesNonPayeesYtdParDevise)
    if (Object.values(kpi).some(v => v === null)) throw new ErreurDevisesIncompatibles()
  }
  return kpi
}

async function computeKpiCompta(
  userId: string,
  year: number,
  asOf: Date,
  deviseCourante: Devise,
): Promise<KPICompta> {
  const startOfYearN1 = new Date(year - 1, 0, 1, 0, 0, 0, 0)
  const endOfYearN1 = new Date(year - 1, 11, 31, 23, 59, 59, 999)
  // Ticket DEV2 #1 — Borne haute "YTD" : pour l'année passée, on lit
  // l'année entière. Sinon une sélection 2024 retournait tout depuis
  // 2024 jusqu'à `now`.
  const isCurrentYear = asOf.getFullYear() === year
  const { debut: startOfYear, fin: upperBound } = bornesExerciceKpi(year, asOf)
  const asOfN1 = isCurrentYear ? shiftToPrevYear(asOf) : endOfYearN1

  // ============================================================
  // REVENUS : VenteManuelle + LigneFacture (factures non annulées)
  // ============================================================
  // Ticket cmvflua2x (2026-10-19) : les revenus de l'exercice sont lus ligne à
  // ligne et ventilés par module dans le même calcul ; le total exposé est la
  // somme de cette ventilation, qui ne peut donc plus s'en écarter.
  // Lot devise-totaux-api (16/11/2026) : les mêmes lignes sont ventilées par
  // devise (une pièce garde sa devise figée, un montant sans devise figée suit
  // la devise courante) ; deux devises ne s'additionnent jamais côté écran.
  const [revenusExercice, revenusN1] = await Promise.all([
    chargerRevenusExercice(userId, startOfYear, upperBound, deviseCourante),
    chargerLignesRevenusDevise(userId, startOfYearN1, endOfYearN1, deviseCourante),
  ])
  const revenusN1YtdLignes = revenusN1.filter((l) => l.date <= asOfN1)

  const revenusN1YtdParDevise = sommerParDevise(revenusN1YtdLignes, l => l.monnaie, l => l.montant, deviseCourante)
  const revenusN1TotalParDevise = sommerParDevise(revenusN1, l => l.monnaie, l => l.montant, deviseCourante)

  // ============================================================
  // DÉPENSES : DepenseManuelle
  // ============================================================
  // Lot devise-totaux-api, tour 2 (inventaire du 16/11/2026) : une dépense n'a
  // pas de colonne de devise, mais une dépense réglée a un dossier de
  // règlement dont la devise est figée ; elle fait foi. Sans dossier, la
  // dépense suit la devise courante de l'exploitation.
  const depensesLues = await chargerLignesDepensesDevise(userId, startOfYearN1, plusTardive(upperBound, endOfYearN1), deviseCourante)
  const depensesExercice = depensesLues.filter((l) => l.date >= startOfYear && l.date <= upperBound)
  const depensesN1Total = depensesLues.filter((l) => l.date <= endOfYearN1)
  const depensesN1YtdLignes = depensesN1Total.filter((l) => l.date <= asOfN1)
  const parDeviseDepenses = (lignes: LigneDepenseDevise[]) => sommerParDevise(lignes, (l) => l.monnaie, (l) => l.montant, deviseCourante)

  const encours = await chargerEncoursCompta(userId, startOfYear, upperBound, deviseCourante)

  const revenusYtdParDevise = revenusExercice.parDevise
  const depensesYtdParDevise = parDeviseDepenses(depensesExercice)
  const depensesN1YtdParDevise = parDeviseDepenses(depensesN1YtdLignes)
  const depensesN1TotalParDevise = parDeviseDepenses(depensesN1Total)
  const beneficeYtdParDevise = soustraireParDevise(revenusYtdParDevise, depensesYtdParDevise)
  const depensesNonPayeesYtdParDevise = sommerParDevise(
    encours.dettes.items, d => d.monnaie === undefined ? deviseCourante : d.monnaie, d => d.montant, deviseCourante)
  const revenusNonPayesYtdParDevise = sommerParDevise(
    encours.creances.items, i => monnaieImpayee(i, deviseCourante), i => i.montant, deviseCourante)

  return {
    year,
    asOf,
    deviseCourante,
    revenusYtd: totalSiUneDevise(revenusYtdParDevise),
    revenusYtdParDevise,
    revenusParModuleYtd: revenusExercice.ventilation,
    revenusN1Ytd: totalSiUneDevise(revenusN1YtdParDevise),
    revenusN1YtdParDevise,
    revenusN1Total: totalSiUneDevise(revenusN1TotalParDevise),
    revenusN1TotalParDevise,
    depensesYtd: totalSiUneDevise(depensesYtdParDevise),
    depensesYtdParDevise,
    depensesN1Ytd: totalSiUneDevise(depensesN1YtdParDevise),
    depensesN1YtdParDevise,
    depensesN1Total: totalSiUneDevise(depensesN1TotalParDevise),
    depensesN1TotalParDevise,
    beneficeYtd: totalSiUneDevise(beneficeYtdParDevise),
    beneficeYtdParDevise,
    margePercentYtd: margeParDevise(revenusYtdParDevise, depensesYtdParDevise),
    depensesNonPayeesYtd: totalSiUneDevise(depensesNonPayeesYtdParDevise),
    depensesNonPayeesYtdParDevise,
    nbDepensesNonPayees: encours.dettes.nombre,
    revenusNonPayesYtd: totalSiUneDevise(revenusNonPayesYtdParDevise),
    revenusNonPayesYtdParDevise,
    nbRevenusNonPayes: encours.creances.items.length,
  }
}

/** Ligne de revenu réduite à sa date, son montant signé et sa devise. */
interface LigneRevenuDevise { date: Date; montant: number; monnaie: Devise | null }

/**
 * Revenus d'une période, ligne à ligne, avec leur devise : mêmes ventes et
 * mêmes factures (avoirs soustraits) que le total des revenus.
 */
async function chargerLignesRevenusDevise(
  userId: string,
  debut: Date,
  fin: Date,
  deviseCourante: Devise,
): Promise<LigneRevenuDevise[]> {
  const [ventes, factures] = await Promise.all([
    prisma.venteManuelle.findMany({
      where: whereVentesRevenus(userId, debut, fin),
      select: { date: true, montant: true, ...SELECT_CONTEXTE_FISCAL_VENTE },
    }),
    prisma.facture.findMany({
      where: whereFacturesRevenus(userId, debut, fin),
      select: { date: true, type: true, totalTTC: true, emetteurSnapshot: true },
    }),
  ])
  return [
    ...ventes.map((v) => ({ date: v.date, montant: v.montant, monnaie: monnaieVente(v, deviseCourante) })),
    ...factures.map((f) => ({
      date: f.date,
      montant: (f.type === 'avoir' ? -1 : 1) * f.totalTTC,
      monnaie: monnaieFacture(f.emetteurSnapshot, f.date),
    })),
  ]
}

/** Dépense comptable réduite à sa date, son montant et sa devise (dossier figé, sinon courante). */
interface LigneDepenseDevise { date: Date; montant: number; monnaie: Devise | null }

/** Fin de la lecture des dépenses : l'exercice en cours et toute l'année N-1. */
function plusTardive(a: Date, b: Date): Date {
  return a > b ? a : b
}

/**
 * Dépenses comptables d'une période, ligne à ligne, avec leur devise : même
 * périmètre que le total (`whereDepensesComptables`).
 */
export async function chargerLignesDepensesDevise(
  userId: string,
  debut: Date,
  fin: Date,
  deviseCourante: Devise | null,
): Promise<Array<LigneDepenseDevise & { id: number; categorie: string; module: string | null }>> {
  const depenses = await prisma.depenseManuelle.findMany({
    where: whereDepensesComptables(userId, debut, fin),
    select: { ...SELECT_IDENTITE_DEPENSE, date: true, montant: true, categorie: true, module: true },
  })
  const monnaies = await chargerMonnaiesDepenses(userId, depenses, deviseCourante)
  return depenses.map((d) => ({
    id: d.id, date: d.date, montant: d.montant, categorie: d.categorie, module: d.module,
    monnaie: monnaies.has(d.id) ? monnaies.get(d.id)! : deviseCourante,
  }))
}

/**
 * Revenus et dépenses comptables mois par mois (index 0 = janvier), sur les
 * mêmes écritures et les mêmes bornes que `getKpiCompta` : la somme des mois
 * redonne les totaux affichés. Revue du 2026-11-01 : le graphique mensuel
 * relisait les tables brutes (consommations d'aliments, fertilisations et
 * soins, qui sont des coûts analytiques ; ni l'achat d'un lot ni les factures)
 * et la somme de ses mois s'écartait des dépenses comptables affichées.
 */
export async function chargerMensuelCompta(
  userId: string,
  year: number,
  asOf: Date = new Date(),
): Promise<Array<{ revenus: number; depenses: number }>> {
  const exploitation = await prisma.exploitation.findUnique({ where: { userId }, select: { devise: true, territoire: true } })
  const deviseCourante = deviseCouranteExploitation(exploitation)
  const mois = await chargerMensuelComptaParDevise(userId, year, asOf, deviseCourante)
  verifierDeviseCalcul(deviseCourante, ...mois.flatMap(m => [m.revenusParDevise, m.depensesParDevise]))
  return mois.map(({ revenus, depenses }) => {
    if (revenus === null || depenses === null) throw new ErreurDevisesIncompatibles()
    return { revenus, depenses }
  })
}

/**
 * `chargerMensuelCompta` avec, pour chaque mois, ses revenus devise par devise
 * (même règle que `getKpiCompta` : devise figée de la pièce, sinon
 * `deviseCourante`) ; ses dépenses de même (devise du dossier de règlement,
 * sinon `deviseCourante`).
 */
export async function chargerMensuelComptaParDevise(
  userId: string,
  year: number,
  asOf: Date,
  deviseCourante: Devise | null,
): Promise<Array<{ revenus: number | null; depenses: number | null; revenusParDevise: TotalDevise[]; depensesParDevise: TotalDevise[] }>> {
  const { debut, fin } = bornesExerciceKpi(year, asOf)
  const [ventes, factures, depenses] = await Promise.all([
    prisma.venteManuelle.findMany({ where: whereVentesRevenus(userId, debut, fin), select: { date: true, montant: true, ...SELECT_CONTEXTE_FISCAL_VENTE } }),
    prisma.facture.findMany({ where: whereFacturesRevenus(userId, debut, fin), select: { date: true, type: true, totalTTC: true, emetteurSnapshot: true } }),
    chargerLignesDepensesDevise(userId, debut, fin, deviseCourante),
  ])
  const mois = Array.from({ length: 12 }, () => ({ revenus: [] as LigneRevenuDevise[], depenses: [] as LigneDepenseDevise[] }))
  for (const v of ventes) mois[v.date.getMonth()].revenus.push({ date: v.date, montant: v.montant, monnaie: monnaieVente(v, deviseCourante) })
  for (const f of factures) mois[f.date.getMonth()].revenus.push({
    date: f.date, montant: (f.type === 'avoir' ? -1 : 1) * f.totalTTC, monnaie: monnaieFacture(f.emetteurSnapshot, f.date),
  })
  for (const d of depenses) mois[d.date.getMonth()].depenses.push(d)
  return mois.map((m) => {
    const revenusParDevise = sommerParDevise(m.revenus, l => l.monnaie, l => l.montant, deviseCourante)
    const depensesParDevise = sommerParDevise(m.depenses, l => l.monnaie, l => l.montant, deviseCourante)
    return { revenus: totalSiUneDevise(revenusParDevise), depenses: totalSiUneDevise(depensesParDevise), revenusParDevise, depensesParDevise }
  })
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
 * mêmes factures que le total des revenus de `getKpiCompta`. Une facture prend
 * le module de la vente métier qu'elle porte, un avoir celui de sa facture
 * d'origine, une facture saisie sans vente va en « Autre ».
 */
/** Factures du périmètre comptable, avec leur module et celui de l'origine des avoirs. */
export async function chargerFacturesRevenus(userId: string, debut: Date, fin: Date) {
  const factures = await prisma.facture.findMany({
    where: whereFacturesRevenus(userId, debut, fin),
    select: { id: true, numero: true, type: true, statut: true, date: true, clientNom: true, objet: true,
      totalTTC: true, factureOrigineId: true, modePaiement: true, emetteurSnapshot: true,
      lignes: { select: { articleStockType: true } }, _count: { select: VENTES_PORTEES } },
  })
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
    const modulesStock = [...new Set(f.lignes.filter((l) => l.articleStockType).map((l): ModuleCompta => l.articleStockType === 'recolte' ? 'potager' : ['fruit', 'bois', 'transforme'].includes(l.articleStockType!) ? 'verger' : ['oeufs', 'ruche', 'fromage'].includes(l.articleStockType!) ? 'elevage' : 'autre'))]
    if (modulesStock.length) { moduleParFacture.set(f.id, modulesStock.length === 1 ? modulesStock[0] : 'autre'); continue }
    moduleParFacture.set(f.id, moduleDesVentesPortees({ ...f._count, recoltes: recoltesParFacture.get(f.id) ?? 0 }))
  }

  return factures.map(f => ({ ...f, moduleSource: f.type === 'avoir'
    ? f.factureOrigineId != null ? moduleParFacture.get(f.factureOrigineId) ?? null : null
    : moduleParFacture.get(f.id) ?? null }))
}

/** Revenus par devise et module ; ventilation scalaire indisponible en mélange. */
export async function chargerRevenusExercice(userId: string, debut: Date, fin: Date, deviseCourante: Devise) {
  const [ventes, factures] = await Promise.all([
    prisma.venteManuelle.findMany({
      where: whereVentesRevenus(userId, debut, fin),
      select: { montant: true, module: true, categorie: true, ...SELECT_CONTEXTE_FISCAL_VENTE },
    }),
    chargerFacturesRevenus(userId, debut, fin),
  ])
  const parDevise = ventilerRevenusParDevise(
    ventes, factures,
    v => monnaieVente(v, deviseCourante),
    f => monnaieFacture(f.emetteurSnapshot, f.date),
    deviseCourante,
  )
  const ventilation: VentilationRevenus | null = parDevise.length === 1
    ? { total: parDevise[0].total, parModule: parDevise[0].parModule, composition: parDevise[0].composition }
    : null
  return { ventilation, parDevise }
}
