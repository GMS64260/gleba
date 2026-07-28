/**
 * API État physiologique du troupeau (PROMPT 24, dérivé — 0 migration).
 * GET /api/elevage/etat-physiologique
 *
 * Par femelle active : lactation / gestante / tarie / vide / nullipare, déduit
 * des mises-bas, saillies gestantes et dernière collecte. Renvoie aussi la
 * répartition du troupeau.
 */

import { NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { etatPhysiologique, pariteFemelle, LABELS_ETAT, LABELS_PARITE } from '@/lib/elevage/etat-physiologique'

export async function GET(request: Request) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const filiere = new URL(request.url).searchParams.get('filiere')

    const femelles = await prisma.animal.findMany({
      where: { userId, statut: 'actif', sexe: 'femelle', ...(filiere ? { especeAnimale: { filiere } } : {}) },
      select: { id: true, nom: true, identifiant: true, especeAnimale: { select: { nom: true } } },
    })
    const ids = femelles.map((f) => f.id)
    if (ids.length === 0) {
      return NextResponse.json({ data: [], repartition: {} })
    }

    const [naissances, sailliesGestantes, dernieresCollectes] = await Promise.all([
      prisma.naissanceAnimale.findMany({
        where: { userId, mereId: { in: ids } },
        select: { mereId: true, date: true },
      }),
      prisma.saillie.findMany({
        where: { userId, femelleId: { in: ids }, statut: 'Gestante' },
        select: { femelleId: true, date: true },
      }),
      prisma.collecteLait.groupBy({
        by: ['animalId'],
        where: { userId, animalId: { in: ids } },
        _max: { date: true },
      }),
    ])

    const derniereMiseBas = new Map<number, number>()
    const nbMisesBas = new Map<number, number>()
    for (const n of naissances) {
      if (n.mereId == null) continue
      const t = new Date(n.date).getTime()
      const cur = derniereMiseBas.get(n.mereId)
      if (cur == null || t > cur) derniereMiseBas.set(n.mereId, t)
      nbMisesBas.set(n.mereId, (nbMisesBas.get(n.mereId) ?? 0) + 1)
    }
    const gestanteApres = new Map<number, boolean>()
    for (const s of sailliesGestantes) {
      const t = new Date(s.date).getTime()
      const mb = derniereMiseBas.get(s.femelleId)
      // Gestante seulement si la saillie gestante est postérieure à la dernière mise-bas
      if (mb == null || t > mb) gestanteApres.set(s.femelleId, true)
    }
    const collecteMax = new Map<number, Date | null>()
    for (const c of dernieresCollectes) {
      if (c.animalId != null) collecteMax.set(c.animalId, c._max.date)
    }

    const data = femelles.map((f) => {
      const etat = etatPhysiologique({
        aMisBas: derniereMiseBas.has(f.id),
        gestante: gestanteApres.get(f.id) === true,
        derniereCollecte: collecteMax.get(f.id) ?? null,
      })
      // QA caprin cms1vgm9n — parité en dimension séparée : une chevrette
      // gestante est « Gestante » (cycle) ET « Nullipare » (parité).
      const parite = pariteFemelle(nbMisesBas.get(f.id) ?? 0)
      return {
        id: f.id,
        nom: f.nom,
        identifiant: f.identifiant,
        espece: f.especeAnimale?.nom ?? null,
        etat,
        label: LABELS_ETAT[etat],
        parite,
        labelParite: LABELS_PARITE[parite],
      }
    })

    const repartition: Record<string, number> = {}
    for (const d of data) repartition[d.etat] = (repartition[d.etat] || 0) + 1
    const repartitionParite: Record<string, number> = {}
    for (const d of data) repartitionParite[d.parite] = (repartitionParite[d.parite] || 0) + 1

    return NextResponse.json({ data, repartition, labels: LABELS_ETAT, repartitionParite, labelsParite: LABELS_PARITE })
  } catch (err) {
    console.error('GET /api/elevage/etat-physiologique error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
