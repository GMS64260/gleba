/**
 * API Espèces Animales — Référentiel communautaire.
 * GET  /api/elevage/especes-animales — Liste (visibilité communauté/perso)
 * POST /api/elevage/especes-animales — Créer une espèce
 *   - Admin : catalogue Gleba officiel (userId null).
 *   - Utilisateur : perso (userId = lui), proposé à la communauté ou privé.
 *
 * Édition / suppression : voir /api/elevage/especes-animales/[id].
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { visibiliteReferentiel, attributionCreation } from '@/lib/referentiel-communaute'
import { coerceFiliere } from '@/lib/elevage/filiere'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // volaille, mammifere_petit, mammifere_grand
    const production = searchParams.get('production') // oeufs, viande, mixte
    const filiere = searchParams.get('filiere') // rente, compagnie, equin, nac

    const where: any = {}
    if (type) where.type = type
    if (production) where.production = production
    if (filiere) where.filiere = filiere

    // Visibilité catalogue communautaire : Gleba officiel (userId null) +
    // communauté (partagé par un membre) + mes propres espèces perso. Jamais
    // le perso privé d'un autre. On combine avec les filtres existants via AND.
    const whereVisible = { AND: [where, visibiliteReferentiel(userId)] }

    const especes = await prisma.especeAnimale.findMany({
      where: whereVisible,
      orderBy: { nom: 'asc' },
    })

    // Bug cmp8seb49 (Marc 2026-05-16) — _count.animaux incluait TOUS les
    // animaux (tous users + tous statuts), donnant 15 individuels et 6 lots
    // alors que le Dashboard comptait 33 (4 individus actifs + 29 en lots).
    // On scope par utilisateur connecté et on filtre sur statut actif.
    // Pour les lots, on remonte effectifReel = somme(quantiteActuelle).
    const especeIds = especes.map((e) => e.id)

    const [animauxParEspece, lotsParEspece] = await Promise.all([
      prisma.animal.groupBy({
        by: ['especeAnimaleId'],
        where: { userId, statut: 'actif', especeAnimaleId: { in: especeIds } },
        _count: true,
      }),
      prisma.lotAnimaux.groupBy({
        by: ['especeAnimaleId'],
        where: { userId, statut: 'actif', especeAnimaleId: { in: especeIds } },
        _count: true,
        _sum: { quantiteActuelle: true },
      }),
    ])
    const animauxMap = new Map(animauxParEspece.map((a) => [a.especeAnimaleId, a._count]))
    const lotsMap = new Map(
      lotsParEspece.map((l) => [
        l.especeAnimaleId,
        { count: l._count, effectif: l._sum.quantiteActuelle ?? 0 },
      ])
    )

    const data = especes.map((e) => {
      const lots = lotsMap.get(e.id) ?? { count: 0, effectif: 0 }
      return {
        ...e,
        _count: {
          animaux: animauxMap.get(e.id) ?? 0,
          lots: lots.count,
        },
        // Bonus pour les écrans qui veulent l'effectif réel (individus + lots)
        effectifTotal: (animauxMap.get(e.id) ?? 0) + lots.effectif,
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/elevage/especes-animales error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des espèces', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

  try {
    const body = await request.json()
    const {
      id,
      nom,
      type,
      filiere,
      production,
      categorieReglementaire,
      productions,
      dureeGestation,
      dureeCouvaison,
      dureeElevage,
      poidsAdulte,
      rendementCarcasse,
      ponteAnnuelle,
      consommationJour,
      prixAchat,
      couleur,
      description,
    } = body

    if (!id || !nom || !type) {
      return NextResponse.json(
        { error: 'ID, nom et type sont requis' },
        { status: 400 }
      )
    }

    // Phase 0 « modes d'élevage » : la production est une donnée de rente.
    // Hors rente (compagnie/équin/NAC) elle est facultative → valeur neutre.
    const filiereVal = coerceFiliere(filiere)
    const productionFinal = filiereVal === 'rente' ? production : (production || 'compagnie')
    if (filiereVal === 'rente' && !productionFinal) {
      return NextResponse.json(
        { error: 'La production est requise pour une espèce de rente' },
        { status: 400 }
      )
    }

    // Création : admin → catalogue Gleba officiel (userId null) ;
    // utilisateur → perso (userId = lui), proposé à la communauté ou privé.
    const espece = await prisma.especeAnimale.create({
      data: {
        id,
        nom,
        type,
        filiere: filiereVal,
        production: productionFinal,
        categorieReglementaire: categorieReglementaire ?? null,
        productions: Array.isArray(productions) ? productions : [],
        dureeGestation,
        dureeCouvaison,
        dureeElevage,
        poidsAdulte,
        rendementCarcasse,
        ponteAnnuelle,
        consommationJour,
        prixAchat,
        couleur,
        description,
        ...attributionCreation(isAdmin, session!.user.id, body.partageCommunaute === true),
      },
    })

    return NextResponse.json({ data: espece }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/elevage/especes-animales error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Une espèce avec cet ID existe déjà' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Erreur lors de la création', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
