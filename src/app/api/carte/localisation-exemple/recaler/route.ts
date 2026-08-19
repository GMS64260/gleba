/**
 * POST /api/carte/localisation-exemple/recaler
 *
 * Recale en UNE action la parcelle restée à l'emplacement d'exemple (Paris 4ᵉ)
 * sur la commune réelle de l'exploitation.
 *
 * Jusqu'ici, le bandeau de recalage n'offrait qu'une consigne : « sélectionnez
 * la parcelle, puis Déplacer dans la barre d'outils » — une manipulation de
 * carte, sur une page (`/jardin/carte`) que le segment concerné ne visite pas
 * (suivi 2026-08-16 : le maraîcher quotidien y a redéclenché deux fois les
 * appels Hub'Eau parisiens sans jamais voir le bandeau). La correction doit
 * être possible là où la donnée fausse est consommée, et tenir en un clic.
 *
 * Garde-fous : on ne recale QUE une parcelle dont le centroïde est encore celui
 * de l'exemple, et seulement si elle appartient au demandeur. Le contour est
 * remplacé par un carré autour du centre communal — l'utilisateur l'affine
 * ensuite sur la carte, ce que le champ `notes` lui rappelle.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { estCentroidExemple } from '@/lib/localisation-exemple'
import { coordonneesValides, parcelleCarreeAutour } from '@/lib/onboarding-config'
import { zoneClimatiqueDepuisCodePostal } from '@/lib/terroir'

const schema = z.object({
  parcelleId: z.string().min(1),
  commune: z.object({
    nom: z.string().min(1).max(200),
    codePostal: z.string().max(10).optional().nullable(),
    lat: z.number(),
    lng: z.number(),
  }),
})

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = getUserId(session)

  try {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const { parcelleId, commune } = parsed.data

    if (!coordonneesValides(commune.lat, commune.lng)) {
      return NextResponse.json(
        { error: 'Coordonnées de commune invalides' },
        { status: 400 },
      )
    }

    // Propriété + état : jamais toucher une parcelle déjà positionnée par
    // l'utilisateur (le recalage serait une perte de son travail).
    const parcelle = await prisma.parcelleGeo.findFirst({
      where: { id: parcelleId, userId },
      select: { id: true, nom: true, centroidLat: true, centroidLng: true },
    })
    if (!parcelle) {
      return NextResponse.json({ error: 'Parcelle introuvable' }, { status: 404 })
    }
    if (!estCentroidExemple(parcelle.centroidLat, parcelle.centroidLng)) {
      return NextResponse.json(
        {
          error:
            "Cette parcelle n'est plus à son emplacement d'exemple : modifiez son contour depuis la carte.",
        },
        { status: 409 },
      )
    }

    const carre = parcelleCarreeAutour(commune.lat, commune.lng)
    await prisma.parcelleGeo.update({
      where: { id: parcelle.id },
      data: {
        geometry: carre.geometry,
        centroidLat: carre.centroidLat,
        centroidLng: carre.centroidLng,
        commune: commune.nom,
        notes: `Position approximative : centre de ${commune.nom}. Affinez le contour depuis la carte.`,
      },
    })

    // Compléter le siège de l'exploitation s'il est vide : le code postal est
    // la source PREMIÈRE de la zone climatique (terroirDeUser), le centroïde
    // n'étant qu'un repli grossier.
    if (commune.codePostal) {
      const exploitation = await prisma.exploitation.findUnique({
        where: { userId },
        select: { codePostal: true, ville: true },
      })
      if (exploitation && !exploitation.codePostal?.trim()) {
        await prisma.exploitation.update({
          where: { userId },
          data: {
            codePostal: commune.codePostal,
            ...(exploitation.ville?.trim() ? {} : { ville: commune.nom }),
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      parcelle: { id: parcelle.id, nom: parcelle.nom },
      commune: commune.nom,
      zoneClimat: zoneClimatiqueDepuisCodePostal(commune.codePostal),
    })
  } catch (err) {
    console.error('POST /api/carte/localisation-exemple/recaler error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
