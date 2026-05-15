/**
 * QA Julien 2026-05-15 — Bug #11 : drill-down lot. Cette route alimente
 * la fiche `/elevage/lots/[id]`.
 *
 * GET /api/elevage/lots/[id] → header + liste animaux du lot.
 *
 * Note coord Dev 1 (BUG #8) : les KPI agrégés (production cumulée, soins
 * à venir, etc.) ne sont pas calculés ici. La v1 expose juste l'effectif
 * réel (count animaux statut='actif' + quantiteActuelle pour lots-non-
 * nominatifs). Dev 1 ajoutera ses agrégats dans un payload séparé.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { id: idParam } = await params
  const id = parseInt(idParam, 10)
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'ID de lot invalide' }, { status: 400 })
  }

  try {
    const lot = await prisma.lotAnimaux.findFirst({
      where: { id, userId: session.user.id },
      include: {
        especeAnimale: { select: { id: true, nom: true, type: true, couleur: true } },
        parcelleGeo: { select: { id: true, nom: true } },
        animaux: {
          orderBy: [{ statut: 'asc' }, { identifiant: 'asc' }],
          select: {
            id: true,
            identifiant: true,
            nom: true,
            race: true,
            sexe: true,
            statut: true,
            poidsActuel: true,
            dateNaissance: true,
            especeAnimale: { select: { id: true, nom: true, couleur: true } },
          },
        },
        _count: { select: { animaux: true, productionsOeufs: true, soins: true } },
      },
    })

    if (!lot) {
      return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }

    // Effectif réel : count des animaux statut='actif' si le lot est
    // nominatif (au moins 1 animal lié), sinon `quantiteActuelle` (lot
    // anonyme type poulailler). Permet d'afficher un compteur fiable
    // pour les deux modes.
    const animauxActifs = lot.animaux.filter((a) => a.statut === 'actif').length
    const effectifReel = lot._count.animaux > 0 ? animauxActifs : lot.quantiteActuelle

    return NextResponse.json({
      data: {
        ...lot,
        effectifReel,
      },
    })
  } catch (err) {
    console.error('GET /api/elevage/lots/[id] error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du lot' },
      { status: 500 }
    )
  }
}
