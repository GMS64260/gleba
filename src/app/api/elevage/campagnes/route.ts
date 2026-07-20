/**
 * API Campagnes de lutte / reproduction (PROMPT 24).
 * GET / POST / PATCH / DELETE  /api/elevage/campagnes
 *
 * Planifie les périodes de lutte (monte, désaisonnement, effet bouc) pour
 * étaler les mises-bas et suivre la réussite par groupe. Les saillies s'y
 * rattachent (Saillie.campagneId).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

const TYPES_CONDUITE = [
  'Monte naturelle',
  'Désaisonnement lumineux',
  'Traitement hormonal',
  'Effet bouc',
  'IA',
] as const

const campagneSchema = z.object({
  nom: z.string().min(1).max(200),
  typeConduite: z.enum(TYPES_CONDUITE),
  especeAnimaleId: z.string().nullable().optional(),
  dateDebut: z.coerce.date(),
  dateFin: z.coerce.date().nullable().optional(),
  objectifMiseBas: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})
const updateCampagneSchema = campagneSchema.partial().extend({ id: z.string().min(1) })

export async function GET() {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session.user.id

  const campagnes = await prisma.campagneReproduction.findMany({
    where: { userId },
    orderBy: { dateDebut: 'desc' },
    include: {
      especeAnimale: { select: { nom: true } },
      _count: { select: { saillies: true } },
      saillies: { select: { statut: true } },
    },
  })

  // Agrège la réussite par campagne (fertilité intra-campagne)
  const data = campagnes.map((c) => {
    const issues = c.saillies.filter((s) => s.statut !== 'En attente')
    const fecondantes = c.saillies.filter((s) => s.statut === 'Gestante' || s.statut === 'Mise-bas réalisée')
    return {
      id: c.id,
      nom: c.nom,
      typeConduite: c.typeConduite,
      espece: c.especeAnimale?.nom ?? null,
      especeAnimaleId: c.especeAnimaleId,
      dateDebut: c.dateDebut,
      dateFin: c.dateFin,
      objectifMiseBas: c.objectifMiseBas,
      notes: c.notes,
      nbSaillies: c._count.saillies,
      tauxReussite: issues.length > 0 ? Math.round((fecondantes.length / issues.length) * 1000) / 10 : null,
    }
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  try {
    const parsed = campagneSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data
    const campagne = await prisma.campagneReproduction.create({
      data: {
        userId: session.user.id,
        nom: d.nom,
        typeConduite: d.typeConduite,
        especeAnimaleId: d.especeAnimaleId ?? null,
        dateDebut: d.dateDebut,
        dateFin: d.dateFin ?? null,
        objectifMiseBas: d.objectifMiseBas ?? null,
        notes: d.notes ?? null,
      },
    })
    return NextResponse.json({ data: campagne }, { status: 201 })
  } catch (err) {
    console.error('POST /api/elevage/campagnes error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  try {
    const parsed = updateCampagneSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const { id, ...updates } = parsed.data
    const existing = await prisma.campagneReproduction.findFirst({ where: { id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    const campagne = await prisma.campagneReproduction.update({ where: { id }, data: updates })
    return NextResponse.json({ data: campagne })
  } catch (err) {
    console.error('PATCH /api/elevage/campagnes error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })
  const existing = await prisma.campagneReproduction.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
  // Les saillies rattachées sont détachées (FK onDelete: SetNull) — pas de perte.
  await prisma.campagneReproduction.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
