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
import { visibiliteReferentiel, attributionCreation, masquerEntree } from '@/lib/referentiel-communaute'
import { coerceFiliere } from '@/lib/elevage/filiere'
import { rendementCarcasseEnRatio, validerRendementCarcasseApi } from '@/lib/elevage/rendement-carcasse'
import { chargerCheptelEnStock } from '@/lib/elevage/stock-cheptel'

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
    const especeIds = especes.map((e) => e.id)

    // Revue 2026-10-20 — l'effectif des lots est l'effectif reconstitué
    // (écran Lots, fiches rattachées comprises), partitionné comme Stocks :
    // `effectifTotal` = fiches actives hors lot actif + effectif des lots.
    const [animauxParEspece, cheptel] = await Promise.all([
      prisma.animal.groupBy({
        by: ['especeAnimaleId'],
        where: { userId, statut: 'actif', especeAnimaleId: { in: especeIds } },
        _count: true,
      }),
      chargerCheptelEnStock(userId),
    ])
    const animauxMap = new Map(animauxParEspece.map((a) => [a.especeAnimaleId, a._count]))
    const horsLotMap = new Map(cheptel.individuels.map((i) => [i.especeAnimaleId, i.tetes]))
    const lotsMap = new Map<string, { count: number; effectif: number }>()
    for (const l of cheptel.lots) {
      const courant = lotsMap.get(l.especeAnimaleId) ?? { count: 0, effectif: 0 }
      lotsMap.set(l.especeAnimaleId, { count: courant.count + 1, effectif: courant.effectif + l.tetes })
    }

    const data = especes.map((e) => {
      const lots = lotsMap.get(e.id) ?? { count: 0, effectif: 0 }
      return {
        // Revue 2026-10-20 — jamais l'id d'un autre compte (marqueur d'origine).
        ...masquerEntree(e, userId),
        // QA cmvgeif10 — toujours un ratio, même pour une ancienne entrée en %.
        rendementCarcasse: rendementCarcasseEnRatio(e.rendementCarcasse),
        _count: {
          animaux: animauxMap.get(e.id) ?? 0,
          lots: lots.count,
        },
        // Bonus pour les écrans qui veulent l'effectif réel (individus + lots)
        effectifTotal: (horsLotMap.get(e.id) ?? 0) + lots.effectif,
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

    // QA cmvgeif10 — le rendement carcasse est un ratio du poids vif ; un
    // pourcentage (65) est refusé en nommant le champ et l'unité.
    const rendement = validerRendementCarcasseApi(rendementCarcasse)
    if (!rendement.ok) {
      return NextResponse.json({ error: rendement.erreur, champ: 'rendementCarcasse' }, { status: 400 })
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
        rendementCarcasse: rendement.ratio,
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
