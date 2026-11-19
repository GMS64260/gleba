/**
 * API Route pour le plan du jardin
 * GET /api/jardin - Récupère les planches avec positions et cultures actives
 * (année choisie non terminée, plus les vivaces non terminées de toute année)
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { moduleOuvert } from '@/lib/exploitation/modules-chemins'
import { lireAnnee } from '@/lib/api/annee'

// GET /api/jardin?annee=AAAA&parcelle=ID|all|none
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  // Plan de la ferme, surface partagée (arbres et objets ont leurs routes) :
  // ses planches et cultures relèvent du maraîchage. Membre dont l'adhésion
  // exclut le maraîchage : aucune planche, sans lecture.
  if (!moduleOuvert(session!.user.modulesExploitation, 'maraichage')) return NextResponse.json([])

  try {
    const parcelle = request.nextUrl.searchParams.get('parcelle')
    const anneeBrute = request.nextUrl.searchParams.get('annee')
    // Le plan affiche une année précise : pas de repli silencieux ni de « all ».
    if (anneeBrute !== null && (anneeBrute.length !== 4 || !/^\d{4}$/.test(anneeBrute) || Number(anneeBrute) < 2000 || Number(anneeBrute) > 2200)) {
      return NextResponse.json(
        { error: 'L’année doit être un entier entre 2000 et 2200', champ: 'annee' },
        { status: 400 },
      )
    }
    const { annee } = lireAnnee(request.nextUrl.searchParams)

    // Filtre par parcelle (optionnel)
    const where: Record<string, unknown> = { userId: session!.user.id }
    if (parcelle && parcelle !== 'all') {
      if (parcelle === 'none') {
        where.parcelleGeoId = null
      } else {
        where.parcelleGeoId = parcelle
      }
    }

    const planches = await prisma.planche.findMany({
      where,
      select: {
        id: true,
        nom: true,
        largeur: true,
        longueur: true,
        posX: true,
        posY: true,
        rotation2D: true,
        ilot: true,
        type: true,
        parcelleGeoId: true,
        parcelleGeo: {
          select: { id: true, nom: true }
        },
        cultures: {
          // Cultures non terminées de l'année choisie (courante par défaut).
          // Le plan ne reconstitue pas l'occupation historique d'une planche.
          //
          // 2026-09-02 : une VIVACE (fraisier, asperge, artichaut, rhubarbe…)
          // reste en place d'une année sur l'autre. Tant qu'elle n'est pas
          // terminée, elle occupe sa planche quelle que soit son année de
          // plantation — le filtre d'année ne la concerne pas. Constaté sur un
          // compte réel le 2026-08-25 : des fraisiers plantés en 2023 absents du
          // plan, trois questions à l'assistant, départ le jour même.
          where: {
            terminee: null,
            OR: [{ annee }, { espece: { vivace: true } }],
          },
          select: {
            id: true,
            nbRangs: true,
            espacement: true,
            // Dates réelles : servent au « plan vivant » (croissance interpolée)
            dateSemis: true,
            datePlantation: true,
            dateRecolte: true,
            finRecolte: true,
            itp: {
              select: {
                espacementRangs: true,
                espacement: true,
                dureeCulture: true,
                dureeRecolte: true
              }
            },
            espece: {
              select: {
                id: true,
                nom: true,
                couleur: true,
                etalement: true,
                // Lu par croissanceCulture() : une vivace ne libère jamais sa
                // planche à la fin d'une fenêtre de récolte.
                vivace: true,
                famille: {
                  select: { id: true, couleur: true }
                }
              }
            }
          },
          orderBy: { annee: 'desc' }
        }
      },
      orderBy: { nom: 'asc' }
    })

    return NextResponse.json(planches)
  } catch (error) {
    console.error('GET /api/jardin error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du plan' },
      { status: 500 }
    )
  }
}
