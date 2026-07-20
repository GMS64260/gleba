/**
 * API Palmarès lait par chèvre (PROMPT 21).
 * GET /api/elevage/palmares-lait?annee=2026
 *
 * Reconstitue les lactations de chaque femelle laitière (mise-bas → collectes)
 * et renvoie la lactation de référence de l'année sélectionnée avec lait 305 j
 * standardisé, pic, moyenne journalière, TB/TP et cellules moyens, plus le rang
 * de lactation. Sert au tri pour les décisions de réforme / renouvellement.
 *
 * Agrégation à la volée — aucune migration (cf. feuille de route vault 2026-07-20).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { synthetiseLactations, type LactationSynthese } from '@/lib/lait'

const estLaitier = (production?: string | null, productions?: string[] | null): boolean => {
  const p = (production || '').toLowerCase()
  if (p.includes('lait') || p.includes('mixte')) return true
  return (productions || []).some((x) => x.toLowerCase().includes('lait'))
}

/** Choisit la lactation de référence pour l'année : celle qui chevauche l'année, la plus récente ; sinon la dernière connue. */
function lactationReference(lactations: LactationSynthese[], annee: number): LactationSynthese | null {
  if (lactations.length === 0) return null
  const startY = new Date(annee, 0, 1).getTime()
  const endY = new Date(annee, 11, 31, 23, 59, 59).getTime()
  const chevauche = lactations.filter((l) => {
    const debut = new Date(l.debut).getTime()
    const fin = l.fin ? new Date(l.fin).getTime() : Number.POSITIVE_INFINITY
    return debut <= endY && fin >= startY
  })
  const pool = chevauche.length > 0 ? chevauche : lactations
  // La plus récente (debut le plus tardif)
  return pool.reduce((best, l) => (new Date(l.debut).getTime() > new Date(best.debut).getTime() ? l : best))
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || `${new Date().getFullYear()}`, 10) || new Date().getFullYear()
    const userId = session.user.id

    const animaux = await prisma.animal.findMany({
      where: { userId, statut: 'actif' },
      select: {
        id: true,
        nom: true,
        identifiant: true,
        sexe: true,
        especeAnimale: { select: { nom: true, production: true, productions: true } },
      },
    })
    // Femelles (ou sexe inconnu) laitières — on exclut les mâles, non traits.
    const femelles = animaux.filter(
      (a) =>
        estLaitier(a.especeAnimale?.production, a.especeAnimale?.productions) &&
        (a.sexe === 'femelle' || a.sexe == null || a.sexe === 'inconnu')
    )
    const ids = femelles.map((a) => a.id)
    if (ids.length === 0) {
      return NextResponse.json({ data: [], stats: { nbChevres: 0, annee } })
    }

    const [naissances, collectes] = await Promise.all([
      prisma.naissanceAnimale.findMany({
        where: { userId, mereId: { in: ids } },
        select: { mereId: true, date: true },
        orderBy: { date: 'asc' },
      }),
      prisma.collecteLait.findMany({
        where: { userId, animalId: { in: ids } },
        select: { animalId: true, date: true, quantiteLitres: true, mgGpl: true, mpGpl: true, cellulesParMl: true },
        orderBy: { date: 'asc' },
      }),
    ])

    const naissancesParMere = new Map<number, { date: Date }[]>()
    for (const n of naissances) {
      if (n.mereId == null) continue
      const arr = naissancesParMere.get(n.mereId) || []
      arr.push({ date: n.date })
      naissancesParMere.set(n.mereId, arr)
    }
    const collectesParAnimal = new Map<number, { date: Date; quantiteLitres: number; mg: number | null; mp: number | null; cellules: number | null }[]>()
    for (const c of collectes) {
      if (c.animalId == null) continue
      const arr = collectesParAnimal.get(c.animalId) || []
      arr.push({
        date: c.date,
        quantiteLitres: Number(c.quantiteLitres),
        mg: c.mgGpl != null ? Number(c.mgGpl) : null,
        mp: c.mpGpl != null ? Number(c.mpGpl) : null,
        cellules: c.cellulesParMl,
      })
      collectesParAnimal.set(c.animalId, arr)
    }

    const lignes = femelles
      .map((a) => {
        const lactations = synthetiseLactations(
          naissancesParMere.get(a.id) || [],
          collectesParAnimal.get(a.id) || []
        )
        const ref = lactationReference(lactations, annee)
        if (!ref || ref.nbTraites === 0) return null
        return {
          animalId: a.id,
          nom: a.nom,
          identifiant: a.identifiant,
          espece: a.especeAnimale?.nom ?? null,
          nbLactations: lactations.filter((l) => l.rang != null).length,
          lactation: ref,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      // Palmarès : meilleur lait 305 j d'abord
      .sort((a, b) => b.lactation.lait305 - a.lactation.lait305)

    // Repères troupeau
    const lait305s = lignes.map((l) => l.lactation.lait305).filter((v) => v > 0)
    const moyennes = lignes.map((l) => l.lactation.moyenneJour).filter((v) => v > 0)
    const moy = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null)
    const stats = {
      annee,
      nbChevres: lignes.length,
      lait305Moyen: (() => {
        const m = moy(lait305s)
        return m != null ? Math.round(m) : null
      })(),
      moyenneJourTroupeau: (() => {
        const m = moy(moyennes)
        return m != null ? Math.round(m * 100) / 100 : null
      })(),
      meilleure: lignes[0] ? { nom: lignes[0].nom || lignes[0].identifiant, lait305: lignes[0].lactation.lait305 } : null,
    }

    return NextResponse.json({ data: lignes, stats })
  } catch (err) {
    console.error('GET /api/elevage/palmares-lait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
