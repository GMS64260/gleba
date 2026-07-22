import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

const contratSchema = z.object({ entity: z.literal('contrat'), client: z.string().trim().min(1).max(200), production: z.string().trim().min(1).max(100), dateDebut: z.coerce.date(), dateFin: z.coerce.date().nullable().optional(), prix: z.string().trim().max(500).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional() })
const echeanceSchema = z.object({ entity: z.literal('echeance'), libelle: z.string().trim().min(1).max(200), categorie: z.enum(['PAC', 'IDENTIFICATION', 'SANITAIRE', 'ASSURANCE', 'AUTRE']), dateEcheance: z.coerce.date(), montant: z.number().nonnegative().nullable().optional(), notes: z.string().trim().max(5000).nullable().optional() })

export async function GET() {
  const { session, error } = await requireAuthApi(); if (error) return error
  const userId = session.user.id
  const [contrats, echeances] = await Promise.all([
    prisma.contratElevage.findMany({ where: { userId }, orderBy: [{ actif: 'desc' }, { dateFin: 'asc' }] }),
    prisma.echeanceAdministrativeElevage.findMany({ where: { userId }, orderBy: { dateEcheance: 'asc' } }),
  ])
  return NextResponse.json({ data: { contrats, echeances } })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi(); if (error) return error
  const body = await request.json()
  if (body.entity === 'contrat') {
    const parsed = contratSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    const { entity: _, ...data } = parsed.data
    return NextResponse.json({ data: await prisma.contratElevage.create({ data: { ...data, userId: session.user.id } }) }, { status: 201 })
  }
  const parsed = echeanceSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  const { entity: _, ...data } = parsed.data
  return NextResponse.json({ data: await prisma.echeanceAdministrativeElevage.create({ data: { ...data, userId: session.user.id } }) }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi(); if (error) return error
  const body = await request.json(); const id = typeof body.id === 'string' ? body.id : ''
  if (!id || !['contrat', 'echeance'].includes(body.entity)) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  if (body.entity === 'contrat') {
    const found = await prisma.contratElevage.findFirst({ where: { id, userId: session.user.id } }); if (!found) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
    return NextResponse.json({ data: await prisma.contratElevage.update({ where: { id }, data: { actif: Boolean(body.actif) } }) })
  }
  const found = await prisma.echeanceAdministrativeElevage.findFirst({ where: { id, userId: session.user.id } }); if (!found) return NextResponse.json({ error: 'Échéance introuvable' }, { status: 404 })
  const statut = z.enum(['a_faire', 'fait', 'annule']).safeParse(body.statut); if (!statut.success) return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  return NextResponse.json({ data: await prisma.echeanceAdministrativeElevage.update({ where: { id }, data: { statut: statut.data } }) })
}
