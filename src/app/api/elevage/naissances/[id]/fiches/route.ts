/**
 * POST /api/elevage/naissances/[id]/fiches
 *
 * Crée une fiche Animal nominative pour chaque petit VIVANT d'une mise bas qui
 * n'en a pas encore (idempotent via PetitNaissance.animalId). Évolution QA #4
 * (2026-07-24) : éviter de ressaisir chaque chevreau (boucle, sexe, poids, lot,
 * généalogie) après une naissance multiple.
 *
 * Rattachement automatique : mère (mereId du troupeau, ou mereIdentifiant),
 * père (pereIdentifiant de la mise bas), lot des petits, espèce + race héritées
 * de la mère (ou de l'espèce du lot si mise bas de lot sans mère nominative).
 *
 * Comptabilité : la mise bas incrémente déjà `lot.quantiteActuelle` du nombre
 * de vivants (comptage anonyme du groupe). En créant des fiches nominatives
 * rattachées à ce lot, on DÉCRÉMENTE d'autant pour ne pas compter deux fois
 * (le petit passe du comptage de groupe au comptage individuel).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { enregistrerChangementLot } from '@/lib/elevage/animal-lot'

function modeElevageLabel(mode: string | null): string | null {
  if (mode === 'sous_mere') return 'Élevé sous la mère'
  if (mode === 'biberon') return 'Élevé au biberon'
  return null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const { id } = await params
    const naissanceId = parseInt(id, 10)
    if (!Number.isFinite(naissanceId)) {
      return NextResponse.json({ error: 'Identifiant de naissance invalide' }, { status: 400 })
    }

    const naissance = await prisma.naissanceAnimale.findFirst({
      where: { id: naissanceId, userId },
      include: {
        mere: {
          select: {
            id: true,
            especeAnimaleId: true,
            race: true,
            raceAnimaleId: true,
            orientationProduction: true,
          },
        },
        lot: { select: { id: true, especeAnimaleId: true, quantiteActuelle: true } },
        petits: { orderBy: { numero: 'asc' } },
      },
    })
    if (!naissance) {
      return NextResponse.json({ error: 'Naissance introuvable' }, { status: 404 })
    }

    // Espèce : héritée de la mère, sinon de l'espèce du lot des petits.
    const especeAnimaleId = naissance.mere?.especeAnimaleId ?? naissance.lot?.especeAnimaleId ?? null
    if (!especeAnimaleId) {
      return NextResponse.json(
        { error: "Impossible de déterminer l'espèce : renseignez une mère du troupeau ou un lot pour les petits." },
        { status: 400 },
      )
    }

    // Petits vivants restant à créer (idempotence).
    const aCreer = naissance.petits.filter((p) => p.vivant && p.animalId == null)
    if (aCreer.length === 0) {
      return NextResponse.json(
        { data: { created: 0 }, message: 'Toutes les fiches des petits existent déjà.' },
        { status: 200 },
      )
    }

    const dateNaissance = naissance.date
    const lotId = naissance.lotId ?? null

    const created = await prisma.$transaction(async (tx) => {
      const ids: number[] = []
      for (const p of aCreer) {
        const identifiant = p.boucleDefinitive || p.boucleProvisoire || null
        const notesParts = [modeElevageLabel(p.modeElevage), p.notes].filter(Boolean)
        const animal = await tx.animal.create({
          data: {
            userId,
            especeAnimaleId,
            lotId,
            identifiant,
            typeIdentifiant: null, // boucle provisoire acceptée (pas de validation regex)
            sexe: p.sexe ?? null,
            dateNaissance,
            dateArrivee: dateNaissance,
            mereId: naissance.mereId ?? null,
            pereIdentifiant: naissance.pereIdentifiant ?? null,
            race: naissance.mere?.race ?? null,
            raceAnimaleId: naissance.mere?.raceAnimaleId ?? null,
            orientationProduction: naissance.mere?.orientationProduction ?? null,
            poidsActuel: p.poids ?? null,
            statut: 'actif',
            provenance: 'Naissance',
            notes: notesParts.length > 0 ? notesParts.join(' — ') : null,
          },
          select: { id: true, lotId: true },
        })
        // Lien d'idempotence petit ↔ fiche.
        await tx.petitNaissance.update({
          where: { id: p.id },
          data: { animalId: animal.id },
        })
        if (animal.lotId != null) {
          await enregistrerChangementLot(
            tx, userId, animal.id, null, animal.lotId,
            dateNaissance, 'Affectation à la création de la fiche du petit',
          )
        }
        ids.push(animal.id)
      }

      // Anti double comptage : le petit passe du comptage de groupe (incrément
      // fait à la mise bas) au comptage individuel. On décrémente le lot du
      // nombre de fiches créées, plancher à 0.
      if (lotId != null && ids.length > 0) {
        // Décrément atomique protégé par un verrou de ligne : aucune naissance,
        // vente ou correction concurrente ne peut être écrasée par une valeur
        // absolue lue avant la transaction.
        await tx.$queryRaw`SELECT id FROM lots_animaux WHERE id = ${lotId} FOR UPDATE`
        const courant = await tx.lotAnimaux.findFirst({
          where: { id: lotId, userId },
          select: { quantiteActuelle: true },
        })
        if (!courant) throw new Error('Lot des petits introuvable')
        await tx.lotAnimaux.update({
          where: { id: lotId },
          data: { quantiteActuelle: Math.max(0, courant.quantiteActuelle - ids.length) },
        })
      }

      return ids
    })

    return NextResponse.json({ data: { created: created.length, animalIds: created } }, { status: 201 })
  } catch (err) {
    console.error('POST /api/elevage/naissances/[id]/fiches error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la création des fiches', details: 'Erreur interne du serveur' },
      { status: 500 },
    )
  }
}
