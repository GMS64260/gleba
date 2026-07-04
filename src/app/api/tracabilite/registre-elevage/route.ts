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

    const [animaux, naissances, soins, lots, lotsReformes, abattages] = await Promise.all([
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

      // Lots réformés dans l'année — sorties omises auparavant (audit #40)
      prisma.lotAnimaux.findMany({
        where: {
          userId,
          dateReforme: { gte: startOfYear, lte: endOfYear },
        },
        include: {
          especeAnimale: { select: { nom: true } },
        },
        orderBy: { dateReforme: 'asc' },
      }),

      // Abattages de l'année (individuels ou par lot) — sorties omises
      // auparavant (audit #40). On exclut les abattages annulés.
      prisma.abattage.findMany({
        where: {
          userId,
          dateAnnulation: null,
          date: { gte: startOfYear, lte: endOfYear },
        },
        include: {
          animal: { select: { nom: true, identifiant: true, especeAnimale: { select: { nom: true } } } },
          lot: { select: { nom: true, especeAnimale: { select: { nom: true } } } },
        },
        orderBy: { date: 'asc' },
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

    // Sorties par lot réformé
    lotsReformes.forEach(l => {
      if (l.dateReforme) {
        entries.push({
          date: l.dateReforme.toISOString(),
          type: 'sortie',
          animal: l.nom || `Lot #${l.id}`,
          espece: l.especeAnimale.nom,
          identifiant: `Lot ${l.quantiteActuelle} tetes`,
          detail: `Réforme du lot (${l.quantiteActuelle} tête${l.quantiteActuelle > 1 ? 's' : ''})`,
          lot: l.nom || `Lot #${l.id}`,
        })
      }
    })

    // Abattages (sorties)
    abattages.forEach(ab => {
      const espece = ab.animal?.especeAnimale?.nom || ab.lot?.especeAnimale?.nom || '-'
      const nom = ab.animal?.nom || ab.animal?.identifiant || ab.lot?.nom || 'animal'
      entries.push({
        date: ab.date.toISOString(),
        type: 'sortie',
        animal: nom,
        espece,
        identifiant: ab.animal?.identifiant || (ab.lot ? `Lot (${ab.quantite} tête${ab.quantite > 1 ? 's' : ''})` : '-'),
        detail: `Abattage${ab.quantite > 1 ? ` (${ab.quantite} têtes)` : ''} - ${ab.destination}${ab.poidsCarcasse ? ` - ${ab.poidsCarcasse} kg carcasse` : ''}`,
        lot: ab.lot?.nom || '-',
      })
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
