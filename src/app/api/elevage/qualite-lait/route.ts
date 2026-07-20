/**
 * API Qualité du lait / cellules (PROMPT 20).
 * GET /api/elevage/qualite-lait?fenetre=180
 *
 * Exploite les analyses déjà saisies sur CollecteLait (cellulesParMl, mgGpl,
 * mpGpl) pour détecter les mammites subcliniques : par animal (et par lot)
 * laitier, dernière numération cellulaire, moyenne sur la fenêtre, tendance
 * et statut selon les seuils de la filière (cf. src/lib/lait.ts).
 *
 * Aucune migration : purement dérivé des données existantes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import {
  analyseQualiteLait,
  categorieCellules,
  SEUILS_CELLULES,
  type MesureQualite,
} from '@/lib/lait'

const estLaitier = (production?: string | null, productions?: string[] | null): boolean => {
  const p = (production || '').toLowerCase()
  if (p.includes('lait') || p.includes('mixte')) return true
  return (productions || []).some((x) => x.toLowerCase().includes('lait'))
}

// Poids de tri : alerte d'abord, puis surveillance, puis ok
const POIDS_STATUT: Record<string, number> = { alerte: 0, surveillance: 1, ok: 2 }

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const fenetre = Math.min(Math.max(parseInt(searchParams.get('fenetre') || '180', 10) || 180, 30), 730)
    const userId = session.user.id
    const since = new Date(Date.now() - fenetre * 86_400_000)

    // Animaux et lots laitiers actifs
    const [animaux, lots] = await Promise.all([
      prisma.animal.findMany({
        where: { userId, statut: 'actif' },
        select: {
          id: true,
          nom: true,
          identifiant: true,
          especeAnimale: {
            select: { nom: true, production: true, productions: true, categorieReglementaire: true },
          },
        },
      }),
      prisma.lotAnimaux.findMany({
        where: { userId, statut: 'actif' },
        select: {
          id: true,
          nom: true,
          especeAnimale: {
            select: { nom: true, production: true, productions: true, categorieReglementaire: true },
          },
        },
      }),
    ])

    const animauxLaitiers = animaux.filter((a) =>
      estLaitier(a.especeAnimale?.production, a.especeAnimale?.productions)
    )
    const lotsLaitiers = lots.filter((l) =>
      estLaitier(l.especeAnimale?.production, l.especeAnimale?.productions)
    )

    // Collectes de la fenêtre portant au moins une analyse
    const collectes = await prisma.collecteLait.findMany({
      where: {
        userId,
        date: { gte: since },
        OR: [{ cellulesParMl: { not: null } }, { mgGpl: { not: null } }, { mpGpl: { not: null } }],
      },
      select: {
        animalId: true,
        lotId: true,
        date: true,
        cellulesParMl: true,
        mgGpl: true,
        mpGpl: true,
      },
    })

    const mesuresParAnimal = new Map<number, MesureQualite[]>()
    const mesuresParLot = new Map<number, MesureQualite[]>()
    for (const c of collectes) {
      const m: MesureQualite = {
        date: c.date,
        cellules: c.cellulesParMl,
        mg: c.mgGpl != null ? Number(c.mgGpl) : null,
        mp: c.mpGpl != null ? Number(c.mpGpl) : null,
      }
      if (c.animalId != null) {
        const arr = mesuresParAnimal.get(c.animalId) || []
        arr.push(m)
        mesuresParAnimal.set(c.animalId, arr)
      } else if (c.lotId != null) {
        const arr = mesuresParLot.get(c.lotId) || []
        arr.push(m)
        mesuresParLot.set(c.lotId, arr)
      }
    }

    const lignesAnimaux = animauxLaitiers.map((a) => {
      const cat = categorieCellules(a.especeAnimale?.categorieReglementaire)
      const analyse = analyseQualiteLait(mesuresParAnimal.get(a.id) || [], cat)
      return {
        type: 'animal' as const,
        id: a.id,
        nom: a.nom,
        identifiant: a.identifiant,
        espece: a.especeAnimale?.nom ?? null,
        categorie: cat,
        seuils: SEUILS_CELLULES[cat],
        ...analyse,
      }
    })

    const lignesLots = lotsLaitiers
      .map((l) => {
        const cat = categorieCellules(l.especeAnimale?.categorieReglementaire)
        const analyse = analyseQualiteLait(mesuresParLot.get(l.id) || [], cat)
        return {
          type: 'lot' as const,
          id: l.id,
          nom: l.nom,
          identifiant: null as string | null,
          espece: l.especeAnimale?.nom ?? null,
          categorie: cat,
          seuils: SEUILS_CELLULES[cat],
          ...analyse,
        }
      })
      // Un lot n'apparaît que s'il a des analyses (sinon bruit)
      .filter((l) => l.nbMesures > 0)

    const lignes = [...lignesAnimaux, ...lignesLots].sort((a, b) => {
      const s = POIDS_STATUT[a.statut] - POIDS_STATUT[b.statut]
      if (s !== 0) return s
      return (b.derniere?.cellules ?? -1) - (a.derniere?.cellules ?? -1)
    })

    // Synthèse troupeau (sur mesures brutes de la fenêtre)
    const toutesCellules = collectes.filter((c) => c.cellulesParMl != null).map((c) => c.cellulesParMl as number)
    const toutesMg = collectes.filter((c) => c.mgGpl != null).map((c) => Number(c.mgGpl))
    const toutesMp = collectes.filter((c) => c.mpGpl != null).map((c) => Number(c.mpGpl))
    const moyenne = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null)
    const cellMoy = moyenne(toutesCellules)
    const mgMoy = moyenne(toutesMg)
    const mpMoy = moyenne(toutesMp)

    const avecMesure = lignes.filter((l) => l.nbMesures > 0)
    const troupeau = {
      fenetreJours: fenetre,
      nbSuivis: lignes.length,
      nbAvecMesure: avecMesure.length,
      nbSansMesure: lignes.length - avecMesure.length,
      cellulesMoyennes: cellMoy != null ? Math.round(cellMoy) : null,
      tbMoyen: mgMoy != null ? Math.round(mgMoy * 10) / 10 : null,
      tpMoyen: mpMoy != null ? Math.round(mpMoy * 10) / 10 : null,
      nbAlerte: lignes.filter((l) => l.statut === 'alerte').length,
      nbSurveillance: lignes.filter((l) => l.statut === 'surveillance').length,
    }

    return NextResponse.json({ data: lignes, troupeau })
  } catch (err) {
    console.error('GET /api/elevage/qualite-lait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
