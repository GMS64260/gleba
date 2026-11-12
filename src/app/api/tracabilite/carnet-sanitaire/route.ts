/**
 * Résumé sanitaire de l'élevage (anciennement « carnet sanitaire »)
 * GET /api/tracabilite/carnet-sanitaire?annee=2026
 *
 * C10 (revue réglementaire du 2026-11-12) : ce n'est qu'un RÉSUMÉ des soins
 * réalisés, pas le dossier de contrôle. Il ne reprend ni les délais d'attente,
 * ni la durée du traitement, ni l'ordonnance, ni le fournisseur et la preuve
 * d'achat (règlement (UE) 2019/6, art. 108 §2). Ces pièces sont réunies par le
 * registre d'élevage complet et son archive (`/api/elevage/registre-elevage-complet`),
 * vers lesquels `meta.dossierComplet` oriente. L'URL reste inchangée pour les
 * écrans et liens existants.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { cleTypeSoin, libelleTypeSoin } from '@/lib/elevage/types-soin'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const userId = session!.user.id
    const startOfYear = new Date(annee, 0, 1)
    const endOfYear = new Date(annee, 11, 31, 23, 59, 59)

    // Recuperer les soins RÉALISÉS de l'annee. Audit #70 : le carnet sanitaire
    // réglementaire ne doit lister que les soins effectués (fait=true), pas les
    // soins seulement planifiés (cohérent avec le registre d'élevage).
    const soins = await prisma.soinAnimal.findMany({
      where: {
        userId,
        fait: true,
        date: { gte: startOfYear, lte: endOfYear },
      },
      include: {
        animal: {
          select: {
            id: true,
            nom: true,
            identifiant: true,
            race: true,
            especeAnimale: { select: { nom: true } },
          },
        },
        lot: {
          select: {
            id: true,
            nom: true,
            especeAnimale: { select: { nom: true } },
          },
        },
      },
      orderBy: { date: 'asc' },
    })

    const entries = soins.map((soin) => {
      // Determiner l'animal ou le lot concerne
      let animalLot = ''
      let especeNom = ''

      if (soin.animal) {
        animalLot = soin.animal.nom || soin.animal.identifiant || `Animal #${soin.animal.id}`
        if (soin.animal.race) animalLot += ` (${soin.animal.race})`
        especeNom = soin.animal.especeAnimale.nom
      } else if (soin.lot) {
        animalLot = soin.lot.nom || `Lot #${soin.lot.id}`
        // C10 : seul l'effectif figé au jour du soin est affiché. L'effectif
        // reconstitué (revue du 2026-10-20) était celui d'aujourd'hui, présenté
        // comme le groupe traité ; inconnu, il n'est pas inventé.
        const effectif = soin.effectifTraite
        if (effectif != null && effectif > 0) {
          animalLot += ` (${effectif} ${effectif > 1 ? 'animaux traités' : 'animal traité'})`
        }
        especeNom = soin.lot.especeAnimale.nom
      } else {
        animalLot = 'Non renseigné'
      }

      return {
        id: soin.id,
        date: soin.date.toISOString(),
        animalLot,
        espece: especeNom,
        animalId: soin.animalId,
        lotId: soin.lotId,
        effectifTraite: soin.lot ? soin.effectifTraite ?? null : null,
        // Clé et libellé du type : table unique `types-soin.ts`, partagée avec
        // l'Élevage. Le résumé `parType` et le filtre de l'écran comparent
        // cette même clé (QA 2026-10-19 : tout s'affichait « Autre »).
        type: cleTypeSoin(soin.type),
        typeLabel: libelleTypeSoin(soin.type),
        description: soin.description || null,
        produit: soin.produit || null,
        quantite: soin.quantite || null,
        unite: soin.unite || null,
        cout: soin.cout || null,
        veterinaire: soin.veterinaire || null,
        datePrevue: soin.datePrevue?.toISOString() || null,
        fait: soin.fait,
        notes: soin.notes || null,
      }
    })

    // Stats
    const parType = entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1
      return acc
    }, {})

    const animauxTraites = new Set<string>()
    entries.forEach((e) => {
      if (e.animalId) animauxTraites.add(`animal-${e.animalId}`)
      if (e.lotId) animauxTraites.add(`lot-${e.lotId}`)
    })

    const coutTotal = entries.reduce((sum, e) => sum + (e.cout || 0), 0)

    return NextResponse.json({
      carnet: entries,
      stats: {
        totalSoins: entries.length,
        parType,
        nbAnimauxOuLots: animauxTraites.size,
        coutTotal,
        periodeDebut: entries.length > 0 ? entries[0].date : null,
        periodeFin: entries.length > 0 ? entries[entries.length - 1].date : null,
      },
      meta: {
        annee,
        generatedAt: new Date().toISOString(),
        type: 'resume_sanitaire',
        avertissement:
          "Résumé des soins réalisés. Ce n'est pas le dossier de contrôle : délais d'attente, durée du traitement, ordonnances, fournisseurs et preuves d'achat figurent dans le registre d'élevage complet et son archive.",
        dossierComplet: {
          libelle: "Registre sanitaire & pharmacie (registre d'élevage complet)",
          url: '/elevage?tab=alimentation&sub=registre',
        },
      },
    })
  } catch (err) {
    console.error('GET /api/tracabilite/carnet-sanitaire error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du résumé sanitaire' },
      { status: 500 }
    )
  }
}
