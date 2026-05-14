/**
 * Agrégat unifié des récoltes annuelles — source de vérité pour
 * /maraichage/planification/recoltes-prevues, le module Récoltes et le
 * Dashboard.
 *
 * Audit Marc BUG-03 (2026-05-14) : « Récoltes prévues » affichait 0 kg sur
 * la Planification alors que le module Récoltes et le Dashboard affichaient
 * 90 kg. Cause : la Planif n'utilisait que la PROJECTION (culture × rendement)
 * et ignorait les Recolte réelles déjà saisies. Désormais on combine :
 *
 *   - réalisé   = SUM(Recolte.quantite WHERE date dans l'année)
 *   - projeté   = SUM(culture × rendement) pour les cultures encore en
 *                 cours (recolteFaite=false, non terminée)
 *   - attendu   = réalisé + projeté
 *
 * Les 3 écrans utilisent la même fonction → cohérence garantie.
 */

import prisma from '@/lib/prisma'

export interface RecoltesParEspece {
  especeId: string
  especeCouleur: string | null
  realiseesKg: number
  projectionKg: number
}

export interface RecoltesAnneeAggregat {
  year: number
  realiseesKg: number          // récoltes déjà saisies dans l'année
  projectionKg: number         // estimation pour cultures non encore récoltées
  totalAttenduKg: number       // realisees + projection
  parMois: {
    mois: number               // 1..12
    realiseesKg: number
    projectionKg: number
  }[]
  parEspece: RecoltesParEspece[]
}

const MOIS_PAR_SEMAINE = (semaine: number): number => {
  if (semaine < 1) return 1
  if (semaine > 52) return 12
  // approximation : (semaine / 4.345) arrondi sup, clampé 1..12
  const mois = Math.min(12, Math.max(1, Math.ceil(semaine / 4.345)))
  return mois
}

export async function getRecoltesAnneeAggregat(
  userId: string,
  year: number
): Promise<RecoltesAnneeAggregat> {
  const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0)
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)

  // 1. Récoltes réelles déjà saisies dans l'année.
  const recoltes = await prisma.recolte.findMany({
    where: {
      userId,
      date: { gte: startOfYear, lte: endOfYear },
    },
    select: {
      quantite: true,
      date: true,
      especeId: true,
      espece: { select: { couleur: true } },
    },
  })

  // 2. Cultures de l'année encore en cours (pas récoltées + non terminées).
  // Projection = surface × rendement de l'espèce.
  const cultures = await prisma.culture.findMany({
    where: {
      userId,
      annee: year,
      terminee: null,
      recolteFaite: false,
    },
    select: {
      // Note DEV2 : Culture.dateRecolte (pas .semaineRecolte qui
      // n'existe pas sur le modèle Culture — seulement sur ITP/Variete).
      dateRecolte: true,
      plancheId: true,
      especeId: true,
      planche: { select: { surface: true, largeur: true, longueur: true } },
      espece: { select: { id: true, couleur: true, rendement: true } },
    },
  })

  // Init buckets
  const moisBuckets: { realiseesKg: number; projectionKg: number }[] = Array.from(
    { length: 12 },
    () => ({ realiseesKg: 0, projectionKg: 0 })
  )
  const parEspeceMap = new Map<string, RecoltesParEspece>()

  // Réalisé
  for (const r of recoltes) {
    const mois = r.date.getMonth() // 0..11
    moisBuckets[mois].realiseesKg += r.quantite
    if (r.especeId) {
      const existing = parEspeceMap.get(r.especeId) ?? {
        especeId: r.especeId,
        especeCouleur: r.espece?.couleur ?? null,
        realiseesKg: 0,
        projectionKg: 0,
      }
      existing.realiseesKg += r.quantite
      parEspeceMap.set(r.especeId, existing)
    }
  }

  // Projection
  for (const c of cultures) {
    if (!c.especeId || !c.espece?.rendement) continue
    const surface =
      c.planche?.surface ??
      (c.planche?.largeur && c.planche?.longueur
        ? c.planche.largeur * c.planche.longueur
        : 0)
    if (surface <= 0) continue
    const quantite = surface * c.espece.rendement
    // Note DEV2 : dérive le mois (0..11) depuis Culture.dateRecolte si
    // saisie (la projection se mappe au mois prévu de récolte).
    const mois = c.dateRecolte ? c.dateRecolte.getMonth() : null
    if (mois !== null) moisBuckets[mois].projectionKg += quantite

    const existing = parEspeceMap.get(c.especeId) ?? {
      especeId: c.especeId,
      especeCouleur: c.espece.couleur ?? null,
      realiseesKg: 0,
      projectionKg: 0,
    }
    existing.projectionKg += quantite
    parEspeceMap.set(c.especeId, existing)
  }

  const realiseesKg = round2(
    moisBuckets.reduce((s, m) => s + m.realiseesKg, 0)
  )
  const projectionKg = round2(
    moisBuckets.reduce((s, m) => s + m.projectionKg, 0)
  )
  const totalAttenduKg = round2(realiseesKg + projectionKg)

  return {
    year,
    realiseesKg,
    projectionKg,
    totalAttenduKg,
    parMois: moisBuckets.map((b, i) => ({
      mois: i + 1,
      realiseesKg: round2(b.realiseesKg),
      projectionKg: round2(b.projectionKg),
    })),
    parEspece: Array.from(parEspeceMap.values())
      .map((e) => ({
        ...e,
        realiseesKg: round2(e.realiseesKg),
        projectionKg: round2(e.projectionKg),
      }))
      .sort(
        (a, b) =>
          (b.realiseesKg + b.projectionKg) - (a.realiseesKg + a.projectionKg)
      ),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
