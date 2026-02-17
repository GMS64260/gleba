/**
 * API Dépenses unifiées
 * GET /api/comptabilite/depenses
 * Agrège toutes les dépenses de tous les modules
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const module = searchParams.get('module')
    const limit = parseInt(searchParams.get('limit') || '200')

    const userId = session.user.id
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)

    // Récupérer toutes les sources de dépenses
    const [
      soinsAnimaux,
      operationsArbres,
      consommationsAliments,
      fertilisations,
      achatsLots,
      achatsAnimaux,
      achatsArbres,
      depensesManuelles,
    ] = await Promise.all([
      // SoinAnimal
      prisma.soinAnimal.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          cout: { not: null },
        },
        orderBy: { date: 'desc' },
        include: {
          animal: { select: { nom: true, especeAnimale: { select: { nom: true } } } },
          lot: { select: { nom: true, especeAnimale: { select: { nom: true } } } },
        },
      }),

      // OperationArbre
      prisma.operationArbre.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          cout: { not: null },
        },
        orderBy: { date: 'desc' },
        include: {
          arbre: { select: { nom: true, espece: true } },
        },
      }),

      // ConsommationAliment
      prisma.consommationAliment.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        orderBy: { date: 'desc' },
        include: {
          aliment: {
            select: {
              nom: true,
              prix: true,
              userStocks: {
                where: { userId },
                select: { prix: true },
                take: 1,
              },
            },
          },
          lot: { select: { nom: true } },
        },
      }),

      // Fertilisation
      prisma.fertilisation.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        orderBy: { date: 'desc' },
        include: {
          fertilisant: {
            include: {
              userStocks: {
                where: { userId },
                select: { prix: true },
                take: 1,
              },
            },
          },
        },
      }),

      // LotAnimaux (achats)
      prisma.lotAnimaux.findMany({
        where: {
          userId,
          dateArrivee: { gte: startOfYear, lte: endOfYear },
          prixAchatTotal: { not: null },
        },
        orderBy: { dateArrivee: 'desc' },
        include: {
          especeAnimale: { select: { nom: true } },
        },
      }),

      // Animal (achats individuels)
      prisma.animal.findMany({
        where: {
          userId,
          dateArrivee: { gte: startOfYear, lte: endOfYear },
          prixAchat: { not: null },
        },
        orderBy: { dateArrivee: 'desc' },
        include: {
          especeAnimale: { select: { nom: true } },
        },
      }),

      // Arbre (achats)
      prisma.arbre.findMany({
        where: {
          userId,
          prixAchat: { not: null },
          OR: [
            { dateAchat: { gte: startOfYear, lte: endOfYear } },
            { datePlantation: { gte: startOfYear, lte: endOfYear }, dateAchat: null },
          ],
        },
        orderBy: { dateAchat: 'desc' },
      }),

      // DepenseManuelle
      prisma.depenseManuelle.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        orderBy: { date: 'desc' },
      }),
    ])

    // Transformer en format unifié
    type UnifiedExpense = {
      id: string
      source: string
      sourceId: number
      module: string
      date: string
      description: string
      quantite: number | null
      unite: string | null
      prixUnitaire: number | null
      montant: number
      fournisseur: string | null
      paye: boolean | null
      categorie: string
    }

    const expenses: UnifiedExpense[] = []

    // SoinAnimal -> dépenses
    soinsAnimaux.forEach(s => {
      const nom = s.animal?.nom || s.lot?.nom ||
                  s.animal?.especeAnimale?.nom || s.lot?.especeAnimale?.nom || ''
      expenses.push({
        id: `soin-${s.id}`,
        source: 'SoinAnimal',
        sourceId: s.id,
        module: 'elevage',
        date: s.date.toISOString(),
        description: `${s.type} ${nom}`.trim(),
        quantite: null,
        unite: null,
        prixUnitaire: null,
        montant: s.cout || 0,
        fournisseur: null,
        paye: null,
        categorie: 'Soins animaux',
      })
    })

    // OperationArbre -> dépenses
    operationsArbres.forEach(o => {
      expenses.push({
        id: `operation-${o.id}`,
        source: 'OperationArbre',
        sourceId: o.id,
        module: 'verger',
        date: o.date.toISOString(),
        description: `${o.type} ${o.arbre?.nom || o.arbre?.espece || ''}`.trim(),
        quantite: o.quantite,
        unite: o.unite,
        prixUnitaire: null,
        montant: o.cout || 0,
        fournisseur: null,
        paye: null,
        categorie: 'Opérations arbres',
      })
    })

    // ConsommationAliment -> dépenses (prix per-user avec fallback global)
    consommationsAliments.forEach(c => {
      const userPrix = c.aliment.userStocks?.[0]?.prix ?? c.aliment.prix
      const montant = c.quantite * (userPrix || 0)
      if (montant > 0) {
        expenses.push({
          id: `aliment-${c.id}`,
          source: 'ConsommationAliment',
          sourceId: c.id,
          module: 'elevage',
          date: c.date.toISOString(),
          description: `Aliment ${c.aliment.nom} ${c.lot?.nom || ''}`.trim(),
          quantite: c.quantite,
          unite: 'kg',
          prixUnitaire: userPrix,
          montant,
          fournisseur: null,
          paye: null,
          categorie: 'Aliments',
        })
      }
    })

    // Fertilisation -> dépenses (prix per-user avec fallback global)
    fertilisations.forEach(f => {
      const userPrix = f.fertilisant.userStocks?.[0]?.prix ?? f.fertilisant.prix
      const montant = f.quantite * (userPrix || 0)
      if (montant > 0) {
        expenses.push({
          id: `fertilisation-${f.id}`,
          source: 'Fertilisation',
          sourceId: f.id,
          module: 'potager',
          date: f.date.toISOString(),
          description: `${f.fertilisant.id} sur planche ${f.plancheId}`,
          quantite: f.quantite,
          unite: 'kg',
          prixUnitaire: userPrix,
          montant,
          fournisseur: null,
          paye: null,
          categorie: 'Fertilisation',
        })
      }
    })

    // LotAnimaux achats -> dépenses
    achatsLots.forEach(l => {
      expenses.push({
        id: `lot-${l.id}`,
        source: 'LotAnimaux',
        sourceId: l.id,
        module: 'elevage',
        date: (l.dateArrivee || l.createdAt).toISOString(),
        description: `Achat lot ${l.nom || l.especeAnimale.nom} (${l.quantiteInitiale})`,
        quantite: l.quantiteInitiale,
        unite: 'unité',
        prixUnitaire: l.prixAchatTotal ? l.prixAchatTotal / l.quantiteInitiale : null,
        montant: l.prixAchatTotal || 0,
        fournisseur: l.provenance,
        paye: null,
        categorie: 'Achats animaux',
      })
    })

    // Animal achats -> dépenses
    achatsAnimaux.forEach(a => {
      expenses.push({
        id: `animal-${a.id}`,
        source: 'Animal',
        sourceId: a.id,
        module: 'elevage',
        date: (a.dateArrivee || a.createdAt).toISOString(),
        description: `Achat ${a.nom || a.especeAnimale.nom}`,
        quantite: 1,
        unite: 'unité',
        prixUnitaire: a.prixAchat,
        montant: a.prixAchat || 0,
        fournisseur: a.provenance,
        paye: null,
        categorie: 'Achats animaux',
      })
    })

    // Arbre achats -> dépenses
    achatsArbres.forEach(a => {
      expenses.push({
        id: `arbre-${a.id}`,
        source: 'Arbre',
        sourceId: a.id,
        module: 'verger',
        date: (a.dateAchat || a.datePlantation || a.createdAt).toISOString(),
        description: `Achat ${a.nom}${a.fournisseur ? ` (${a.fournisseur})` : ''}`,
        quantite: 1,
        unite: 'unité',
        prixUnitaire: a.prixAchat,
        montant: a.prixAchat || 0,
        fournisseur: a.fournisseur,
        paye: null,
        categorie: 'Achats arbres',
      })
    })

    // DepenseManuelle -> dépenses
    depensesManuelles.forEach(d => {
      expenses.push({
        id: `depense-${d.id}`,
        source: 'DepenseManuelle',
        sourceId: d.id,
        module: d.module || 'autre',
        date: d.date.toISOString(),
        description: d.description,
        quantite: null,
        unite: null,
        prixUnitaire: null,
        montant: d.montant,
        fournisseur: d.fournisseurNom,
        paye: d.paye,
        categorie: d.categorie === 'materiel' ? 'Matériel' :
                   d.categorie === 'carburant' ? 'Carburant' :
                   d.categorie === 'main_oeuvre' ? 'Main d\'oeuvre' :
                   d.categorie === 'abonnement' ? 'Abonnement' : 'Autre',
      })
    })

    // Filtrer par module si spécifié
    let filtered = expenses
    if (module) {
      filtered = expenses.filter(e => e.module === module)
    }

    // Trier par date décroissante
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Limiter
    const limited = filtered.slice(0, limit)

    // Calculer les stats
    const stats = {
      total: filtered.reduce((sum, e) => sum + e.montant, 0),
      count: filtered.length,
      parModule: {
        potager: filtered.filter(e => e.module === 'potager').reduce((sum, e) => sum + e.montant, 0),
        verger: filtered.filter(e => e.module === 'verger').reduce((sum, e) => sum + e.montant, 0),
        elevage: filtered.filter(e => e.module === 'elevage').reduce((sum, e) => sum + e.montant, 0),
        autre: filtered.filter(e => e.module === 'autre').reduce((sum, e) => sum + e.montant, 0),
      },
      parCategorie: Object.entries(
        filtered.reduce((acc, e) => {
          acc[e.categorie] = (acc[e.categorie] || 0) + e.montant
          return acc
        }, {} as Record<string, number>)
      ).map(([categorie, montant]) => ({ categorie, montant })),
    }

    return NextResponse.json({
      data: limited,
      stats,
      meta: { year, module, total: filtered.length },
    })
  } catch (error) {
    console.error('GET /api/comptabilite/depenses error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
