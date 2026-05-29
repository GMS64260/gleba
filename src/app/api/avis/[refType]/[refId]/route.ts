/**
 * API — Avis communautaires génériques (référentiel communautaire).
 * GET    /api/avis/[refType]/[refId]  — liste + stats + dispersion terroir + production réelle
 * POST   /api/avis/[refType]/[refId]  — créer/mettre à jour SON avis (upsert)
 * DELETE /api/avis/[refType]/[refId]  — supprimer SON avis
 *
 * refType ∈ VARIETE | PORTE_GREFFE | ESPECE | RACE. Ouvert à tout utilisateur
 * connecté (`requireAuthApi`) : les objets notés restent des référentiels gérés
 * par ailleurs, mais chacun peut témoigner.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { terroirDeUser } from '@/lib/terroir'
import { AVIS_REF_TYPES, type AvisRefType, type AvisNotable } from '@/lib/avis/types'
import { criteresKeys } from '@/lib/avis/criteres'
import { calculerStats, moyenneGlobaleNotes, dispersionParTerroir, avisSchema } from '@/lib/avis/stats'
import { rendementReel, badgeTerrain } from '@/lib/avis/data-driven'

type RouteParams = { params: Promise<{ refType: string; refId: string }> }

function parseRefType(raw: string): AvisRefType | null {
  return (AVIS_REF_TYPES as string[]).includes(raw) ? (raw as AvisRefType) : null
}

/** Vérifie que l'objet noté existe (par type). RACE : Phase C. */
async function refExiste(refType: AvisRefType, refId: string): Promise<boolean> {
  switch (refType) {
    case 'VARIETE':
      return !!(await prisma.variete.findUnique({ where: { id: refId }, select: { id: true } }))
    case 'PORTE_GREFFE':
      return !!(await prisma.porteGreffe.findUnique({ where: { id: refId }, select: { id: true } }))
    case 'ESPECE':
      return !!(await prisma.espece.findUnique({ where: { id: refId }, select: { id: true } }))
    case 'RACE':
      return !!(await prisma.raceAnimale.findUnique({ where: { id: refId }, select: { id: true } }))
  }
}

const toNotable = (r: { reprend: boolean | null; notes: unknown; contexteTypeSol: string | null; contexteZoneClimat: string | null }): AvisNotable => ({
  reprend: r.reprend,
  notes: (r.notes ?? {}) as Record<string, number | null>,
  contexteTypeSol: r.contexteTypeSol,
  contexteZoneClimat: r.contexteZoneClimat,
})

// GET /api/avis/[refType]/[refId]
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { refType: rawType, refId: rawId } = await params
    const refType = parseRefType(rawType)
    if (!refType) return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    const refId = decodeURIComponent(rawId)
    const userId = session!.user.id

    const avis = await prisma.avis.findMany({
      where: { refType, refId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    })

    const notables = avis.map(toNotable)
    const stats = calculerStats(notables, moyenneGlobaleNotes(notables), criteresKeys(refType))
    const dispersionTerroir = dispersionParTerroir(notables)
    const reel = (await rendementReel(prisma, refType, [refId])).get(refId)

    const avisPublics = avis.map((a) => ({
      id: a.id,
      auteur: a.user.name || 'Maraîcher',
      isMine: a.user.id === userId,
      reprend: a.reprend,
      notes: (a.notes ?? {}) as Record<string, number | null>,
      commentaire: a.commentaire,
      contexteTypeSol: a.contexteTypeSol,
      contexteZoneClimat: a.contexteZoneClimat,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }))

    return NextResponse.json({
      data: {
        avis: avisPublics,
        monAvis: avisPublics.find((a) => a.isMine) ?? null,
        stats,
        dispersionTerroir,
        reel: reel ?? { nbProductif: 0, nbExploitations: 0, quantiteTotale: 0 },
        badgeTerrain: badgeTerrain(reel),
      },
    })
  } catch (err) {
    console.error('GET /api/avis error:', err)
    return NextResponse.json({ error: 'Erreur lors de la récupération des avis' }, { status: 500 })
  }
}

// POST /api/avis/[refType]/[refId] — upsert
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { refType: rawType, refId: rawId } = await params
    const refType = parseRefType(rawType)
    if (!refType) return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    const refId = decodeURIComponent(rawId)
    const userId = session!.user.id

    if (!(await refExiste(refType, refId))) {
      return NextResponse.json({ error: 'Objet introuvable' }, { status: 404 })
    }

    const parsed = avisSchema(criteresKeys(refType)).safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }

    const terroir = await terroirDeUser(prisma, userId)
    const payload = {
      reprend: parsed.data.reprend ?? null,
      notes: parsed.data.notes ?? {},
      commentaire: parsed.data.commentaire?.trim() || null,
    }

    const avis = await prisma.avis.upsert({
      where: { refType_refId_userId: { refType, refId, userId } },
      update: payload,
      create: {
        refType,
        refId,
        userId,
        ...payload,
        contexteTypeSol: terroir.typeSol,
        contexteZoneClimat: terroir.zoneClimat,
        contexteCodePostal: terroir.codePostal,
      },
    })

    return NextResponse.json({ data: avis }, { status: 201 })
  } catch (err) {
    console.error('POST /api/avis error:', err)
    return NextResponse.json({ error: "Erreur lors de l'enregistrement de l'avis" }, { status: 500 })
  }
}

// DELETE /api/avis/[refType]/[refId] — supprime SON avis (idempotent)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { refType: rawType, refId: rawId } = await params
    const refType = parseRefType(rawType)
    if (!refType) return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    const refId = decodeURIComponent(rawId)
    await prisma.avis.deleteMany({ where: { refType, refId, userId: session!.user.id } })
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    console.error('DELETE /api/avis error:', err)
    return NextResponse.json({ error: "Erreur lors de la suppression de l'avis" }, { status: 500 })
  }
}
