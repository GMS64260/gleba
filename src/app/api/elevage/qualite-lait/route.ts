/**
 * API Qualité du lait / cellules (PROMPT 20).
 * GET /api/elevage/qualite-lait?fenetre=180
 * GET /api/elevage/qualite-lait?start=2020-01-01&end=2020-12-31
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
import { periodeQualiteLait } from '@/lib/elevage/periode-qualite-lait'
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
    const periode = periodeQualiteLait(searchParams)
    if (!periode.ok) return NextResponse.json({ error: periode.error, champ: periode.champ }, { status: 400 })
    const userId = session.user.id

    // Les mêmes bornes servent aux lignes et à la synthèse, cibles sorties comprises.
    const collectes = await prisma.collecteLait.findMany({
      where: {
        userId,
        date: periode.date,
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
    const idsAnimaux = [...new Set(collectes.flatMap(c => c.animalId != null ? [c.animalId] : []))]
    // Une collecte individuelle rattachée à un lot reste une mesure de l'animal.
    const idsLots = [...new Set(collectes.flatMap(c => c.animalId == null && c.lotId != null ? [c.lotId] : []))]

    // Garder les cibles actives et celles ayant réellement une analyse dans
    // la période, même sorties ou sans profil laitier. Le tenant reste requis.
    const [animaux, lots] = await Promise.all([
      prisma.animal.findMany({
        where: { userId, OR: [{ statut: 'actif' }, { id: { in: idsAnimaux } }] },
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
        where: { userId, OR: [{ statut: 'actif' }, { id: { in: idsLots } }] },
        select: {
          id: true,
          nom: true,
          especeAnimale: {
            select: { nom: true, production: true, productions: true, categorieReglementaire: true },
          },
        },
      }),
    ])

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

    const animauxSuivis = animaux.filter((a) =>
      estLaitier(a.especeAnimale?.production, a.especeAnimale?.productions) ||
      mesuresParAnimal.has(a.id)
    )
    const lotsSuivis = lots.filter((l) =>
      estLaitier(l.especeAnimale?.production, l.especeAnimale?.productions) ||
      mesuresParLot.has(l.id)
    )

    const lignesAnimaux = animauxSuivis.map((a) => {
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

    const lignesLots = lotsSuivis
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
      .filter((l) => mesuresParLot.has(l.id))

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
      fenetreJours: periode.fenetreJours,
      periode: periode.periode,
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
