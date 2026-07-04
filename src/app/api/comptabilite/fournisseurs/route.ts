/**
 * API Fournisseurs
 * GET/POST/PATCH/DELETE /api/comptabilite/fournisseurs
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, requireAdminApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { createFournisseurSchema, updateFournisseurSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const actif = searchParams.get('actif')
    const search = searchParams.get('search')

    const where: any = {}
    if (type) where.type = type
    if (actif !== null && actif !== '') where.actif = actif === 'true'
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { contact: { contains: search, mode: 'insensitive' } },
        { ville: { contains: search, mode: 'insensitive' } },
      ]
    }

    const fournisseursRaw = await prisma.fournisseur.findMany({
      where,
      orderBy: { id: 'asc' },
      include: {
        _count: {
          select: { varietes: true, aliments: true }
        }
      }
    })

    // Sécurité (audit 2026-07 #42) : les coordonnées bancaires d'un référentiel
    // partagé ne sont visibles que par les admins. Un utilisateur standard n'a
    // pas à voir l'IBAN/BIC des fournisseurs des autres exploitations.
    const isAdmin = session!.user.role === 'ADMIN'
    const fournisseurs = isAdmin
      ? fournisseursRaw
      : fournisseursRaw.map(({ iban, bic, ribCle, ...rest }) => rest)

    // Stats
    const stats = await prisma.fournisseur.groupBy({
      by: ['type'],
      where: { actif: true },
      _count: true,
    })

    return NextResponse.json({
      data: fournisseurs,
      stats: {
        total: fournisseurs.length,
        actifs: fournisseurs.filter(f => f.actif).length,
        parType: stats.reduce((acc, s) => ({ ...acc, [s.type || 'autre']: s._count }), {}),
      },
    })
  } catch (error) {
    console.error('GET /api/comptabilite/fournisseurs error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAdminApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = createFournisseurSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const data = parsed.data

    const existing = await prisma.fournisseur.findUnique({
      where: { id: data.id },
    })

    if (existing) {
      return NextResponse.json({ error: 'Ce fournisseur existe déjà' }, { status: 400 })
    }

    // DEV2 #5 — Auto-dérivation SIREN depuis SIRET
    const sirenDerived =
      !data.siren && data.siret ? data.siret.replace(/\s+/g, '').substring(0, 9) : data.siren

    const fournisseur = await prisma.fournisseur.create({
      data: {
        id: data.id,
        contact: data.contact ?? null,
        adresse: data.adresse ?? null,
        ville: data.ville ?? null,
        codePostal: data.codePostal ?? null,
        pays: data.pays || 'France',
        email: data.email ?? null,
        telephone: data.telephone ?? null,
        siteWeb: data.siteWeb ?? null,
        siret: data.siret || null,
        siren: sirenDerived || null,
        tvaIntra: data.tvaIntra || null,
        type: data.type || 'Mixte',
        // Bloc bancaire (DEV2 #5)
        iban: data.iban || null,
        bic: data.bic || null,
        ribCle: data.ribCle || null,
        banqueNom: data.banqueNom ?? null,
        conditionsPaiement: data.conditionsPaiement,
        notes: data.notes ?? null,
        actif: data.actif,
      },
    })

    return NextResponse.json({ data: fournisseur }, { status: 201 })
  } catch (error) {
    console.error('POST /api/comptabilite/fournisseurs error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAdminApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = updateFournisseurSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { id, ...updateData } = parsed.data

    const existing = await prisma.fournisseur.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Fournisseur non trouvé' }, { status: 404 })
    }

    const fournisseur = await prisma.fournisseur.update({
      where: { id },
      data: {
        ...(updateData.contact !== undefined && { contact: updateData.contact }),
        ...(updateData.adresse !== undefined && { adresse: updateData.adresse }),
        ...(updateData.ville !== undefined && { ville: updateData.ville }),
        ...(updateData.codePostal !== undefined && { codePostal: updateData.codePostal }),
        ...(updateData.pays !== undefined && { pays: updateData.pays }),
        ...(updateData.email !== undefined && { email: updateData.email }),
        ...(updateData.telephone !== undefined && { telephone: updateData.telephone }),
        ...(updateData.siteWeb !== undefined && { siteWeb: updateData.siteWeb }),
        ...(updateData.siret !== undefined && {
          siret: updateData.siret || null,
          // DEV2 #5 — auto-dérive SIREN si nouvelle valeur SIRET
          ...(updateData.siren === undefined && updateData.siret
            ? { siren: updateData.siret.replace(/\s+/g, '').substring(0, 9) }
            : {}),
        }),
        ...(updateData.siren !== undefined && { siren: updateData.siren || null }),
        ...(updateData.tvaIntra !== undefined && { tvaIntra: updateData.tvaIntra || null }),
        ...(updateData.type !== undefined && { type: updateData.type }),
        ...(updateData.iban !== undefined && { iban: updateData.iban || null }),
        ...(updateData.bic !== undefined && { bic: updateData.bic || null }),
        ...(updateData.ribCle !== undefined && { ribCle: updateData.ribCle || null }),
        ...(updateData.banqueNom !== undefined && { banqueNom: updateData.banqueNom }),
        ...(updateData.conditionsPaiement !== undefined && { conditionsPaiement: updateData.conditionsPaiement }),
        ...(updateData.notes !== undefined && { notes: updateData.notes }),
        ...(updateData.actif !== undefined && { actif: updateData.actif }),
      },
    })

    return NextResponse.json({ data: fournisseur })
  } catch (error) {
    console.error('PATCH /api/comptabilite/fournisseurs error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAdminApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.fournisseur.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Fournisseur non trouvé' }, { status: 404 })
    }

    // Soft delete
    await prisma.fournisseur.update({
      where: { id },
      data: { actif: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/comptabilite/fournisseurs error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
