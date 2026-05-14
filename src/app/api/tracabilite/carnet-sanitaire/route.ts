/**
 * API Carnet Sanitaire d'Elevage
 * GET /api/tracabilite/carnet-sanitaire?annee=2026
 * Genere le carnet sanitaire a partir des SoinAnimal
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const userId = session!.user.id
    const startOfYear = new Date(annee, 0, 1)
    const endOfYear = new Date(annee, 11, 31, 23, 59, 59)

    // Recuperer tous les soins de l'annee
    const soins = await prisma.soinAnimal.findMany({
      where: {
        userId,
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
            quantiteActuelle: true,
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
        animalLot += ` (${soin.lot.quantiteActuelle} animaux)`
        especeNom = soin.lot.especeAnimale.nom
      } else {
        animalLot = 'Non renseigne'
      }

      return {
        id: soin.id,
        date: soin.date.toISOString(),
        animalLot,
        espece: especeNom,
        animalId: soin.animalId,
        lotId: soin.lotId,
        type: soin.type,
        typeLabel:
          soin.type === 'vaccination'
            ? 'Vaccination'
            : soin.type === 'vermifuge'
            ? 'Vermifuge'
            : soin.type === 'traitement'
            ? 'Traitement'
            : 'Autre',
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
        type: 'carnet_sanitaire',
      },
    })
  } catch (err) {
    console.error('GET /api/tracabilite/carnet-sanitaire error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la generation du carnet sanitaire' },
      { status: 500 }
    )
  }
}
