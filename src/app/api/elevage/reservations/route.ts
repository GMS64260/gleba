/**
 * API Réservations d'élevage (Phase 1 — filière compagnie).
 * Liste d'attente / acompte / suivi d'un petit réservé jusqu'à la cession.
 * GET / POST / PATCH / DELETE — tout scopé userId (multi-tenant).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { upsertVenteFromReservationElevage } from '@/lib/auto-compta'
import { invalidateKpi } from '@/lib/kpi'

const STATUTS = ['attente', 'confirmee', 'livree', 'annulee']

class ReservationValidationError extends Error {}

function idNaissance(value: unknown): number | null {
  if (value == null || value === '') return null
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new ReservationValidationError('Portée invalide')
  return id
}

function idPetit(value: unknown): string | null {
  if (value == null || value === '') return null
  const id = String(value).trim()
  if (!id) throw new ReservationValidationError('Petit invalide')
  return id
}

function montantOptionnel(value: unknown, libelle: string): number | null {
  if (value == null || value === '') return null
  const montant = Number(value)
  if (!Number.isFinite(montant) || montant < 0) {
    throw new ReservationValidationError(`${libelle} invalide`)
  }
  return montant
}

function dateOptionnelle(value: unknown): Date | null {
  if (value == null || value === '') return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new ReservationValidationError('Date de livraison invalide')
  return date
}

function estPorteeCompagnie(portee: {
  userId: string
  mere: { especeAnimale: { filiere: string } } | null
  lot: { especeAnimale: { filiere: string } } | null
}, userId: string): boolean {
  return (
    portee.userId === userId &&
    (portee.mere?.especeAnimale.filiere === 'compagnie' ||
      portee.lot?.especeAnimale.filiere === 'compagnie')
  )
}

async function validerReferences(
  userId: string,
  naissanceValue: unknown,
  petitValue: unknown
): Promise<{ naissanceId: number | null; petitNaissanceId: string | null }> {
  let naissanceId = idNaissance(naissanceValue)
  const petitNaissanceId = idPetit(petitValue)

  if (petitNaissanceId) {
    const petit = await prisma.petitNaissance.findFirst({
      where: { id: petitNaissanceId, userId },
      select: {
        naissanceId: true,
        naissance: {
          select: {
            userId: true,
            mere: { select: { especeAnimale: { select: { filiere: true } } } },
            lot: { select: { especeAnimale: { select: { filiere: true } } } },
          },
        },
      },
    })
    if (!petit || !estPorteeCompagnie(petit.naissance, userId)) {
      throw new ReservationValidationError('Petit introuvable')
    }
    if (naissanceId != null && naissanceId !== petit.naissanceId) {
      throw new ReservationValidationError("Le petit n'appartient pas à la portée sélectionnée")
    }
    naissanceId = petit.naissanceId
  } else if (naissanceId != null) {
    const portee = await prisma.naissanceAnimale.findFirst({
      where: { id: naissanceId, userId },
      select: {
        userId: true,
        mere: { select: { especeAnimale: { select: { filiere: true } } } },
        lot: { select: { especeAnimale: { select: { filiere: true } } } },
      },
    })
    if (!portee || !estPorteeCompagnie(portee, userId)) {
      throw new ReservationValidationError('Portée introuvable')
    }
  }

  return { naissanceId, petitNaissanceId }
}

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id
  try {
    const statut = new URL(request.url).searchParams.get('statut')
    const where: { userId: string; statut?: string } = { userId }
    if (statut && STATUTS.includes(statut)) where.statut = statut
    const data = await prisma.reservationElevage.findMany({
      where,
      orderBy: [{ statut: 'asc' }, { dateReservation: 'desc' }],
    })
    return NextResponse.json({ data })
  } catch (e) {
    console.error('GET /api/elevage/reservations', e)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id
  try {
    const b = await request.json()
    if (!b?.acquereurNom || !String(b.acquereurNom).trim()) {
      return NextResponse.json({ error: "Le nom de l'acquéreur est requis" }, { status: 400 })
    }
    const references = await validerReferences(userId, b.naissanceId, b.petitNaissanceId)
    const acompte = montantOptionnel(b.acompte, 'Acompte')
    const montant = montantOptionnel(b.montant, 'Montant')
    if (acompte != null && montant != null && acompte > montant) {
      throw new ReservationValidationError("L'acompte ne peut pas dépasser le montant de la cession")
    }
    const data = await prisma.$transaction(async (tx) => {
      const created = await tx.reservationElevage.create({
        data: {
        userId,
        acquereurNom: String(b.acquereurNom).trim(),
        acquereurEmail: b.acquereurEmail || null,
        acquereurTel: b.acquereurTel || null,
        ...references,
        statut: STATUTS.includes(b.statut) ? b.statut : 'attente',
        acompte,
        montant,
        dateLivraison: dateOptionnelle(b.dateLivraison),
        notes: b.notes || null,
        },
      })
      await upsertVenteFromReservationElevage(tx, userId, created)
      return created
    })
    invalidateKpi(userId)
    return NextResponse.json({ data }, { status: 201 })
  } catch (e) {
    if (e instanceof ReservationValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    console.error('POST /api/elevage/reservations', e)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id
  try {
    const b = await request.json()
    if (!b?.id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const existing = await prisma.reservationElevage.findFirst({
      where: { id: b.id, userId },
    })
    if (!existing) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
    const data: Record<string, unknown> = {}
    if (b.acquereurNom !== undefined) {
      const nom = String(b.acquereurNom).trim()
      if (!nom) throw new ReservationValidationError("Le nom de l'acquéreur est requis")
      data.acquereurNom = nom
    }
    if (b.acquereurEmail !== undefined) data.acquereurEmail = b.acquereurEmail || null
    if (b.acquereurTel !== undefined) data.acquereurTel = b.acquereurTel || null
    if (b.naissanceId !== undefined || b.petitNaissanceId !== undefined) {
      // Changer de portée sans préciser de petit détache le petit précédent ;
      // conserver son id produirait un lien incohérent vers l'ancienne portée.
      const petitCandidat =
        b.petitNaissanceId !== undefined
          ? b.petitNaissanceId
          : b.naissanceId !== undefined
            ? null
            : existing.petitNaissanceId
      const references = await validerReferences(
        userId,
        b.naissanceId !== undefined ? b.naissanceId : existing.naissanceId,
        petitCandidat
      )
      data.naissanceId = references.naissanceId
      data.petitNaissanceId = references.petitNaissanceId
    }
    if (b.statut !== undefined) {
      if (!STATUTS.includes(b.statut)) throw new ReservationValidationError('Statut invalide')
      data.statut = b.statut
    }
    if (b.acompte !== undefined) data.acompte = montantOptionnel(b.acompte, 'Acompte')
    if (b.montant !== undefined) data.montant = montantOptionnel(b.montant, 'Montant')
    if (b.dateLivraison !== undefined) data.dateLivraison = dateOptionnelle(b.dateLivraison)
    if (b.notes !== undefined) data.notes = b.notes || null
    const acompteFinal = b.acompte !== undefined
      ? (data.acompte as number | null)
      : existing.acompte
    const montantFinal = b.montant !== undefined
      ? (data.montant as number | null)
      : existing.montant
    if (acompteFinal != null && montantFinal != null && acompteFinal > montantFinal) {
      throw new ReservationValidationError("L'acompte ne peut pas dépasser le montant de la cession")
    }
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.reservationElevage.update({ where: { id: b.id }, data })
      await upsertVenteFromReservationElevage(tx, userId, saved)
      return saved
    })
    invalidateKpi(userId)
    return NextResponse.json({ data: updated })
  } catch (e) {
    if (e instanceof ReservationValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    console.error('PATCH /api/elevage/reservations', e)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const existing = await prisma.reservationElevage.findFirst({ where: { id, userId }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
    await prisma.$transaction(async (tx) => {
      await tx.venteManuelle.deleteMany({
        where: {
          userId,
          sourceType: 'reservation_elevage',
          sourceRef: { in: [`${id}:acompte`, `${id}:solde`] },
          auto: true,
        },
      })
      await tx.reservationElevage.delete({ where: { id } })
    })
    invalidateKpi(userId)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/elevage/reservations', e)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
