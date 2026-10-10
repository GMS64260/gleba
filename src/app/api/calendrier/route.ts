/**
 * API Route pour le calendrier
 * GET /api/calendrier?start=&end=
 * Retourne les événements (semis, plantations, récoltes, arrosages notés) pour une période.
 *
 * Arrosage : depuis la refonte du 2026-10-10, plus aucun passage n'est planifié
 * d'avance. Le calendrier montre les arrosages NOTÉS (historique) ; le besoin
 * du jour vit dans les tâches (`src/lib/irrigation/a-arroser.ts`).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { jourCivilLocalISO } from '@/lib/irrigation-meteo-decision'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const startStr = searchParams.get('start')
    const endStr = searchParams.get('end')

    if (!startStr || !endStr) {
      return NextResponse.json(
        { error: 'Dates start et end requises' },
        { status: 400 }
      )
    }

    const start = new Date(startStr)
    const end = new Date(endStr)

    // Récupérer toutes les cultures avec des dates dans la période
    const [culturesAvecSemis, culturesAvecPlantation, culturesAvecRecolte, irrigationsPlanifiees] = await Promise.all([
      // Semis
      prisma.culture.findMany({
        where: {
          userId,
          dateSemis: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          especeId: true,
          varieteId: true,
          dateSemis: true,
          semisFait: true,
          espece: {
            select: { couleur: true, nom: true },
          },
          variete: {
            select: { nom: true },
          },
          planche: {
            select: { nom: true, ilot: true },
          },
        },
      }),
      // Plantations
      prisma.culture.findMany({
        where: {
          userId,
          datePlantation: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          especeId: true,
          varieteId: true,
          datePlantation: true,
          plantationFaite: true,
          espece: {
            select: { couleur: true, nom: true },
          },
          variete: {
            select: { nom: true },
          },
          planche: {
            select: { nom: true, ilot: true },
          },
        },
      }),
      // Récoltes
      prisma.culture.findMany({
        where: {
          userId,
          dateRecolte: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          especeId: true,
          varieteId: true,
          dateRecolte: true,
          recolteFaite: true,
          espece: {
            select: { couleur: true, nom: true },
          },
          variete: {
            select: { nom: true },
          },
          planche: {
            select: { nom: true, ilot: true },
          },
        },
      }),
      // Arrosages notés de la période (traces closes)
      prisma.irrigationPlanifiee.findMany({
        where: {
          userId,
          fait: true,
          dateEffective: {
            gte: start,
            lte: end,
          },
        },
        include: {
          culture: {
            select: {
              id: true,
              especeId: true,
              varieteId: true,
              espece: {
                select: { couleur: true, nom: true, besoinEau: true },
              },
              variete: {
                select: { nom: true },
              },
              planche: {
                select: {
                  nom: true,
                  ilot: true,
                },
              },
            },
          },
        },
      }),
    ])

    // Un passage arrose toute la planche : un événement par planche et par jour.
    const parPlancheJour = new Map<string, typeof irrigationsPlanifiees>()
    for (const irr of irrigationsPlanifiees) {
      const jour = jourCivilLocalISO(irr.dateEffective ?? irr.datePrevue)
      const cle = `${irr.culture.planche?.nom ?? `culture:${irr.culture.id}`}:${jour}`
      parPlancheJour.set(cle, [...(parPlancheJour.get(cle) ?? []), irr])
    }
    const irrigationEvents = Array.from(parPlancheJour.values()).map((groupe) => {
      const i = groupe[0]
      const date = (i.dateEffective ?? i.datePrevue).toISOString()
      const especes = Array.from(new Set(groupe.map((g) => g.culture.espece?.nom ?? g.culture.especeId)))
      return {
        id: i.id,
        type: 'irrigation' as const,
        especeId: i.culture.especeId,
        varieteId: null,
        plancheName: i.culture.planche?.nom || null,
        ilot: i.culture.planche?.ilot || null,
        date,
        fait: true,
        couleur: i.culture.espece?.couleur || null,
        especeNom: especes.join(' + '),
        varieteNom: null,
        cultureId: i.culture.id,
        cultureIds: Array.from(new Set(groupe.map((g) => g.culture.id))),
      }
    })

    // Formater les événements.
    const events = [
      ...culturesAvecSemis.map(c => ({
        id: c.id,
        type: 'semis' as const,
        especeId: c.especeId,
        varieteId: c.varieteId || null,
        plancheName: c.planche?.nom || null,
        ilot: c.planche?.ilot || null,
        date: c.dateSemis?.toISOString() || '',
        fait: c.semisFait,
        couleur: c.espece?.couleur || null,
        especeNom: c.espece?.nom ?? c.especeId,
        varieteNom: c.variete?.nom ?? c.varieteId ?? null,
      })),
      ...culturesAvecPlantation.map(c => ({
        id: c.id,
        type: 'plantation' as const,
        especeId: c.especeId,
        varieteId: c.varieteId || null,
        plancheName: c.planche?.nom || null,
        ilot: c.planche?.ilot || null,
        date: c.datePlantation?.toISOString() || '',
        fait: c.plantationFaite,
        couleur: c.espece?.couleur || null,
        especeNom: c.espece?.nom ?? c.especeId,
        varieteNom: c.variete?.nom ?? c.varieteId ?? null,
      })),
      ...culturesAvecRecolte.map(c => ({
        id: c.id,
        type: 'recolte' as const,
        especeId: c.especeId,
        varieteId: c.varieteId || null,
        plancheName: c.planche?.nom || null,
        ilot: c.planche?.ilot || null,
        date: c.dateRecolte?.toISOString() || '',
        fait: c.recolteFaite,
        couleur: c.espece?.couleur || null,
        especeNom: c.espece?.nom ?? c.especeId,
        varieteNom: c.variete?.nom ?? c.varieteId ?? null,
      })),
      ...irrigationEvents,
    ]

    // Trier par date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return NextResponse.json({
      events,
      stats: {
        semis: culturesAvecSemis.length,
        plantations: culturesAvecPlantation.length,
        recoltes: culturesAvecRecolte.length,
        irrigations: irrigationEvents.length,
        total: events.length,
      },
    })
  } catch (error) {
    console.error('GET /api/calendrier error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du calendrier', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
