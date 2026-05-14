/**
 * API Registre d'Elevage - Document reglementaire
 * GET /api/tracabilite/registre-elevage?annee=2026
 *
 * Obligation legale francaise : enregistrement chronologique des entrees,
 * sorties, naissances et deces de tous les animaux.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

interface RegistreEntry {
  date: string
  type: 'entree' | 'sortie' | 'naissance' | 'deces' | 'soin'
  animal: string
  espece: string
  identifiant: string
  detail: string
  lot: string
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())
    const userId = session.user.id
    const startOfYear = new Date(annee, 0, 1)
    const endOfYear = new Date(annee, 11, 31, 23, 59, 59)

    const [animaux, naissances, soins, lots] = await Promise.all([
      // Tous les animaux avec mouvements dans l'annee
      prisma.animal.findMany({
        where: {
          userId,
          OR: [
            { dateArrivee: { gte: startOfYear, lte: endOfYear } },
            { dateSortie: { gte: startOfYear, lte: endOfYear } },
          ],
        },
        include: {
          especeAnimale: { select: { nom: true } },
          lot: { select: { nom: true } },
        },
        orderBy: { dateArrivee: 'asc' },
      }),

      // Naissances de l'annee
      prisma.naissanceAnimale.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        include: {
          mere: {
            select: {
              nom: true,
              identifiant: true,
              especeAnimale: { select: { nom: true } },
            },
          },
        },
        orderBy: { date: 'asc' },
      }),

      // Soins de l'annee (carnet sanitaire)
      prisma.soinAnimal.findMany({
        where: {
          userId,
          fait: true,
          date: { gte: startOfYear, lte: endOfYear },
        },
        include: {
          animal: { select: { nom: true, identifiant: true } },
          lot: { select: { nom: true } },
        },
        orderBy: { date: 'asc' },
      }),

      // Lots avec mouvements
      prisma.lotAnimaux.findMany({
        where: {
          userId,
          dateArrivee: { gte: startOfYear, lte: endOfYear },
        },
        include: {
          especeAnimale: { select: { nom: true } },
        },
        orderBy: { dateArrivee: 'asc' },
      }),
    ])

    // Construire les entrees du registre chronologiquement
    const entries: RegistreEntry[] = []

    // Entrees individuelles
    animaux.forEach(a => {
      if (a.dateArrivee && a.dateArrivee >= startOfYear && a.dateArrivee <= endOfYear) {
        entries.push({
          date: a.dateArrivee.toISOString(),
          type: 'entree',
          animal: a.nom || '-',
          espece: a.especeAnimale.nom,
          identifiant: a.identifiant || '-',
          detail: `Provenance : ${a.provenance || 'inconnue'}${a.prixAchat ? ` - ${a.prixAchat}\u20ac` : ''}`,
          lot: a.lot?.nom || '-',
        })
      }
      if (a.dateSortie && a.dateSortie >= startOfYear && a.dateSortie <= endOfYear) {
        entries.push({
          date: a.dateSortie.toISOString(),
          type: a.statut === 'mort' ? 'deces' : 'sortie',
          animal: a.nom || '-',
          espece: a.especeAnimale.nom,
          identifiant: a.identifiant || '-',
          detail: `${a.statut}${a.causeSortie ? ` - Cause : ${a.causeSortie}` : ''}`,
          lot: a.lot?.nom || '-',
        })
      }
    })

    // Entrees par lot
    lots.forEach(l => {
      if (l.dateArrivee) {
        entries.push({
          date: l.dateArrivee.toISOString(),
          type: 'entree',
          animal: l.nom || `Lot #${l.id}`,
          espece: l.especeAnimale.nom,
          identifiant: `Lot ${l.quantiteInitiale} tetes`,
          detail: `Provenance : ${l.provenance || 'inconnue'}${l.prixAchatTotal ? ` - ${l.prixAchatTotal}\u20ac` : ''}`,
          lot: l.nom || `Lot #${l.id}`,
        })
      }
    })

    // Naissances
    naissances.forEach(n => {
      entries.push({
        date: n.date.toISOString(),
        type: 'naissance',
        animal: n.mere ? (n.mere.nom || n.mere.identifiant || '-') : '-',
        espece: n.mere?.especeAnimale.nom || '-',
        identifiant: '-',
        detail: `${n.nombreNes} ne(s), ${n.nombreVivants} vivant(s)${n.nombreMales ? ` (${n.nombreMales}M/${n.nombreFemelles || 0}F)` : ''}`,
        lot: '-',
      })
    })

    // Soins (carnet sanitaire)
    soins.forEach(s => {
      entries.push({
        date: s.date.toISOString(),
        type: 'soin',
        animal: s.animal ? (s.animal.nom || s.animal.identifiant || '-') : '-',
        espece: '-',
        identifiant: s.animal?.identifiant || '-',
        detail: `${s.type}${s.produit ? ` - ${s.produit}` : ''}${s.description ? ` - ${s.description}` : ''}`,
        lot: s.lot?.nom || '-',
      })
    })

    // Trier chronologiquement
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Params utilisateur pour en-tete
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }).catch(() => null)

    return NextResponse.json({
      annee,
      ferme: {
        nom: user?.name || 'Ma ferme',
        siret: '',
        adresse: '',
      },
      entries,
      stats: {
        totalEntrees: entries.filter(e => e.type === 'entree').length,
        totalSorties: entries.filter(e => e.type === 'sortie').length,
        totalNaissances: entries.filter(e => e.type === 'naissance').length,
        totalDeces: entries.filter(e => e.type === 'deces').length,
        totalSoins: entries.filter(e => e.type === 'soin').length,
      },
    })
  } catch (error) {
    console.error('GET /api/tracabilite/registre-elevage error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la generation du registre', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
