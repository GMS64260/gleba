/**
 * QA Julien 2026-05-15 — Bug #11 : drill-down lot. Cette route alimente
 * la fiche `/elevage/lots/[id]`.
 *
 * GET /api/elevage/lots/[id] → header + liste animaux du lot.
 *
 * Note coord Dev 1 (BUG #8) : les KPI agrégés (production cumulée, soins
 * à venir, etc.) ne sont pas calculés ici. La v1 expose juste l'effectif
 * réel (count animaux statut='actif' + quantiteActuelle pour lots-non-
 * nominatifs). Dev 1 ajoutera ses agrégats dans un payload séparé.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { reconstituerEffectifsLots } from '@/lib/elevage/effectif'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { id: idParam } = await params
  const id = parseInt(idParam, 10)
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'ID de lot invalide' }, { status: 400 })
  }

  try {
    const lot = await prisma.lotAnimaux.findFirst({
      where: { id, userId: session.user.id },
      include: {
        especeAnimale: { select: { id: true, nom: true, type: true, couleur: true } },
        parcelleGeo: { select: { id: true, nom: true } },
        animaux: {
          orderBy: [{ statut: 'asc' }, { identifiant: 'asc' }],
          select: {
            id: true,
            identifiant: true,
            nom: true,
            race: true,
            sexe: true,
            statut: true,
            poidsActuel: true,
            dateNaissance: true,
            especeAnimale: { select: { id: true, nom: true, couleur: true } },
          },
        },
        _count: { select: { animaux: true, productionsOeufs: true, soins: true } },
      },
    })

    if (!lot) {
      return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }

    // Évolution 2026-07-29 — la fiche lot doit être le point d'entrée de son
    // historique économique. Les écritures automatiques sont la source
    // comptable (achat, alimentation, soins, ventes d'abattage) : on les relie
    // aux événements métier du lot sans recalculer les montants.
    const [soins, consommations, abattages] = await Promise.all([
      prisma.soinAnimal.findMany({
        where: { userId: session.user.id, lotId: lot.id },
        select: { id: true },
      }),
      prisma.consommationAliment.findMany({
        where: { userId: session.user.id, lotId: lot.id },
        select: { id: true },
      }),
      prisma.abattage.findMany({
        where: { userId: session.user.id, lotId: lot.id },
        select: { id: true },
      }),
    ])
    const soinIds = soins.map((item) => item.id)
    const consommationIds = consommations.map((item) => item.id)
    const abattageIds = abattages.map((item) => item.id)
    const [depenses, recettes] = await Promise.all([
      prisma.depenseManuelle.findMany({
        where: {
          userId: session.user.id,
          auto: true,
          OR: [
            { sourceType: 'achat_animal', sourceId: lot.id },
            ...(soinIds.length ? [{ sourceType: 'soin_animal', sourceId: { in: soinIds } }] : []),
            ...(consommationIds.length ? [{ sourceType: 'consommation_aliment', sourceId: { in: consommationIds } }] : []),
          ],
        },
        select: { id: true, date: true, description: true, montant: true },
      }),
      abattageIds.length
        ? prisma.venteManuelle.findMany({
            where: {
              userId: session.user.id,
              auto: true,
              sourceType: 'abattage',
              sourceId: { in: abattageIds },
            },
            select: { id: true, date: true, description: true, montant: true },
          })
        : Promise.resolve([]),
    ])
    const mouvementsEconomiques = [
      ...depenses.map((item) => ({
        id: `depense-${item.id}`,
        date: item.date,
        type: 'depense' as const,
        libelle: item.description,
        montant: item.montant,
      })),
      ...recettes.map((item) => ({
        id: `recette-${item.id}`,
        date: item.date,
        type: 'recette' as const,
        libelle: item.description,
        montant: item.montant,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime())

    // Un lot peut contenir à la fois un effectif collectif et des fiches
    // nominatives. La présence d'une seule fiche ne doit donc pas remplacer le
    // compteur du lot par `animauxActifs` (TIN-52).
    const animauxActifs = lot.animaux.filter((a) => a.statut === 'actif').length
    const effectifs = await reconstituerEffectifsLots(session.user.id, [lot])
    const effectifReel = effectifs.get(lot.id)?.effectifCalcule ?? lot.quantiteActuelle

    return NextResponse.json({
      data: {
        ...lot,
        effectifReel,
        animauxNominatifsActifs: animauxActifs,
        effectifCollectif: Math.max(0, effectifReel - animauxActifs),
        prixAchatParAnimal:
          lot.prixAchatTotal != null && lot.quantiteInitiale > 0
            ? lot.prixAchatTotal / lot.quantiteInitiale
            : null,
        mouvementsEconomiques,
        totauxEconomiques: {
          depenses: depenses.reduce((total, item) => total + item.montant, 0),
          recettes: recettes.reduce((total, item) => total + item.montant, 0),
        },
      },
    })
  } catch (err) {
    console.error('GET /api/elevage/lots/[id] error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du lot' },
      { status: 500 }
    )
  }
}
