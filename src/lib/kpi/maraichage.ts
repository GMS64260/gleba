/**
 * KPI Maraîchage — source unique de vérité.
 *
 * Toutes les vues qui affichent un agrégat (surface, récoltes, cultures…)
 * DOIVENT appeler `getKpiMaraichage` au lieu de recalculer localement.
 *
 * Sémantique de la "surface cultivée" vs "surface planifiée" :
 *   - planifiée  = somme des surfaces des planches qui portent une culture
 *                  de l'année `year`, quel que soit le statut.
 *   - cultivée   = idem, mais filtré sur les cultures actives (semisFait OU
 *                  plantationFaite OU recolteFaite) et non terminées.
 *
 * Ces deux valeurs PEUVENT diverger : c'est attendu (cultures planifiées non
 * encore semées). L'UI doit afficher les DEUX, pas l'une à la place de l'autre.
 */

import prisma from '@/lib/prisma'
import type { KPIMaraichage } from './types'
import { shiftToPrevYear } from './types'
import { asOfDayKey, memoize } from './cache'

/**
 * Récupère les KPI maraîchage pour `userId` / `year` à la date `asOf`.
 *
 * @param userId Identifiant utilisateur (multi-tenancy).
 * @param year   Année de référence (ex : 2026).
 * @param asOf   Date "now" pour le calcul YTD ; par défaut, l'instant courant.
 */
export async function getKpiMaraichage(
  userId: string,
  year: number,
  asOf: Date = new Date()
): Promise<KPIMaraichage> {
  const key = `maraichage:${userId}:${year}:${asOfDayKey(asOf)}`
  return memoize(key, () => computeKpiMaraichage(userId, year, asOf))
}

async function computeKpiMaraichage(
  userId: string,
  year: number,
  asOf: Date
): Promise<KPIMaraichage> {
  const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0)
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)
  const endOfYearN1 = new Date(year - 1, 11, 31, 23, 59, 59, 999)
  const startOfYearN1 = new Date(year - 1, 0, 1, 0, 0, 0, 0)
  // Ticket DEV2 #1 — Borne haute YTD : pour l'année en cours c'est `asOf`,
  // pour une année passée c'est la fin de cette année. Sinon, sélectionner
  // 2024 alors qu'on est en 2026 retournait toutes les récoltes 2024+2025+2026.
  const isCurrentYear = asOf.getFullYear() === year
  const upperBound = isCurrentYear ? asOf : endOfYear
  const asOfN1 = isCurrentYear ? shiftToPrevYear(asOf) : endOfYearN1

  const [
    culturesAnnee,
    culturesActivesCount,
    recoltesYtdAgg,
    recoltesN1YtdAgg,
    recoltesN1TotalAgg,
    planchesTotalAgg,
  ] = await Promise.all([
    // Toutes les cultures planifiées pour l'année (toutes statuts confondus).
    // Ticket #4 — On fetch aussi largeur/longueur pour fallback si la
    // colonne `surface` est null en base (état historique avant la
    // visite /jardin qui déclenche le recalcul). Évite "0 m²" au premier
    // affichage tant que l'utilisateur n'a pas ouvert le module jardin.
    prisma.culture.findMany({
      where: { userId, annee: year },
      select: {
        id: true,
        plancheId: true,
        semisFait: true,
        plantationFaite: true,
        recolteFaite: true,
        terminee: true,
        planche: { select: { surface: true, largeur: true, longueur: true } },
      },
    }),

    // Cultures actives : avancées au moins jusqu'au semis ET non terminées.
    prisma.culture.count({
      where: {
        userId,
        annee: year,
        terminee: null,
        OR: [
          { semisFait: true },
          { plantationFaite: true },
          { recolteFaite: true },
        ],
      },
    }),

    prisma.recolte.aggregate({
      where: { userId, date: { gte: startOfYear, lte: upperBound } },
      _sum: { quantite: true },
    }),

    prisma.recolte.aggregate({
      where: { userId, date: { gte: startOfYearN1, lte: asOfN1 } },
      _sum: { quantite: true },
    }),

    prisma.recolte.aggregate({
      where: { userId, date: { gte: startOfYearN1, lte: endOfYearN1 } },
      _sum: { quantite: true },
    }),

    // Ticket #4 — on lit largeur+longueur en plus de surface pour
    // pouvoir calculer le total robuste même quand surface=null en base.
    //
    // QA Camille 2026-05-15 — Bug #2 : "12 planches" persistait au
    // changement d'année. La query d'origine listait toutes les planches
    // du user sans filtrer — on ne compte désormais que les planches
    // qui portent au moins une culture sur `year`. La surface totale
    // suit la même logique pour rester cohérente avec planchesCount.
    prisma.planche.findMany({
      where: {
        userId,
        cultures: { some: { annee: year } },
      },
      select: { surface: true, largeur: true, longueur: true },
    }),
  ])

  // Surface planifiée : on dédoublonne par planche (une même planche peut
  // accueillir plusieurs cultures dans l'année).
  const surfacePlanifieePlanches = new Map<string, number>()
  const surfaceCultiveePlanches = new Map<string, number>()
  for (const c of culturesAnnee) {
    if (!c.plancheId) continue
    // Ticket #4 — fallback dérivé si la colonne surface est null
    const p = c.planche
    const surface = p?.surface
      ?? (p?.largeur && p?.longueur ? p.largeur * p.longueur : 0)
    surfacePlanifieePlanches.set(c.plancheId, surface)
    const active =
      c.terminee === null &&
      (c.semisFait || c.plantationFaite || c.recolteFaite)
    if (active) {
      surfaceCultiveePlanches.set(c.plancheId, surface)
    }
  }
  const surfacePlanifieeM2 = sumValues(surfacePlanifieePlanches)
  const surfaceCultiveeM2 = sumValues(surfaceCultiveePlanches)

  return {
    year,
    asOf,
    surfaceCultiveeM2: round1(surfaceCultiveeM2),
    surfacePlanifieeM2: round1(surfacePlanifieeM2),
    recoltesKgYtd: round2(recoltesYtdAgg._sum.quantite ?? 0),
    recoltesKgN1Ytd: round2(recoltesN1YtdAgg._sum.quantite ?? 0),
    recoltesKgN1Total: round2(recoltesN1TotalAgg._sum.quantite ?? 0),
    culturesActives: culturesActivesCount,
    culturesPlanifiees: culturesAnnee.length,
    planchesCount: planchesTotalAgg.length,
    planchesSurfaceM2: round1(
      planchesTotalAgg.reduce((sum, p) => {
        const s = p.surface ?? (p.largeur && p.longueur ? p.largeur * p.longueur : 0)
        return sum + s
      }, 0)
    ),
  }
}

function sumValues(map: Map<string, number>): number {
  let total = 0
  for (const v of map.values()) total += v
  return total
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
