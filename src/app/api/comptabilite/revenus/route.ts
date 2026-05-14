/**
 * API Revenus unifiés
 * GET /api/comptabilite/revenus
 * Agrège tous les revenus de tous les modules
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { getKpiCompta } from '@/lib/kpi'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const module = searchParams.get('module') // potager, verger, elevage, autre
    const limit = parseInt(searchParams.get('limit') || '200')

    const userId = session.user.id
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)

    // Récupérer toutes les sources de revenus
    const [
      ventesElevage,
      recoltesArbres,
      venteBois,
      venteAbattage,
      recoltesPotager,
      ventesManuelles,
      commandesBoutique,
    ] = await Promise.all([
      // VenteProduit (elevage)
      prisma.venteProduit.findMany({
        where: {
          userId,
          annule: { not: true },
          date: { gte: startOfYear, lte: endOfYear },
        },
        orderBy: { date: 'desc' },
      }),

      // RecolteArbre avec prix (verger fruits) — uniquement vendues
      prisma.recolteArbre.findMany({
        where: {
          userId,
          statut: 'vendu',
          dateVente: { gte: startOfYear, lte: endOfYear },
          prixKg: { not: null },
        },
        orderBy: { dateVente: 'desc' },
        include: {
          arbre: { select: { nom: true, espece: true } },
        },
      }),

      // ProductionBois avec vente (verger bois)
      prisma.productionBois.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          destination: 'vente',
          prixVente: { not: null },
        },
        orderBy: { date: 'desc' },
        include: {
          arbre: { select: { nom: true } },
        },
      }),

      // Abattage avec vente
      prisma.abattage.findMany({
        where: {
          userId,
          annule: { not: true },
          date: { gte: startOfYear, lte: endOfYear },
          destination: 'vente',
          prixVente: { not: null },
        },
        orderBy: { date: 'desc' },
        include: {
          animal: { select: { nom: true, especeAnimale: { select: { nom: true } } } },
          lot: { select: { nom: true, especeAnimale: { select: { nom: true } } } },
        },
      }),

      // Recolte potager vendue
      prisma.recolte.findMany({
        where: {
          userId,
          statut: 'vendu',
          dateVente: { gte: startOfYear, lte: endOfYear },
          prixTotal: { not: null },
        },
        orderBy: { dateVente: 'desc' },
      }),

      // VenteManuelle (exclure auto=true pour eviter le double comptage
      // avec les sources brutes VenteProduit, Abattage, Recolte, etc.)
      prisma.venteManuelle.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          auto: { not: true },
        },
        orderBy: { date: 'desc' },
      }),

      // CommandeBoutique livrées - revenus de la boutique en ligne
      prisma.commandeBoutique.findMany({
        where: {
          userId,
          statut: 'livree',
          createdAt: { gte: startOfYear, lte: endOfYear },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          lignes: { select: { nom: true, quantite: true, unite: true } },
        },
      }),
    ])

    // Transformer en format unifié
    type UnifiedRevenue = {
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
      client: string | null
      paye: boolean | null
      categorie: string
    }

    const revenues: UnifiedRevenue[] = []

    // VenteProduit -> revenus
    ventesElevage.forEach(v => {
      revenues.push({
        id: `vente-${v.id}`,
        source: 'VenteProduit',
        sourceId: v.id,
        module: 'elevage',
        date: v.date.toISOString(),
        description: v.description || `Vente ${v.type}`,
        quantite: v.quantite,
        unite: v.unite,
        prixUnitaire: v.prixUnitaire,
        montant: v.prixTotal,
        client: v.client,
        paye: v.paye,
        categorie: v.type === 'oeufs' ? 'Oeufs' :
                   v.type === 'viande' ? 'Viande' :
                   v.type === 'animal_vivant' ? 'Animal vivant' :
                   v.type === 'lait' ? 'Lait' : 'Autre élevage',
      })
    })

    // RecolteArbre -> revenus
    recoltesArbres.forEach(r => {
      revenues.push({
        id: `recolte-arbre-${r.id}`,
        source: 'RecolteArbre',
        sourceId: r.id,
        module: 'verger',
        date: (r.dateVente || r.date).toISOString(),
        description: `Récolte ${r.arbre?.espece || r.arbre?.nom || 'fruits'}`,
        quantite: r.quantite,
        unite: 'kg',
        prixUnitaire: r.prixKg,
        montant: r.quantite * (r.prixKg || 0),
        client: null,
        paye: null, // Pas de tracking paiement
        categorie: 'Fruits',
      })
    })

    // ProductionBois -> revenus
    venteBois.forEach(b => {
      revenues.push({
        id: `bois-${b.id}`,
        source: 'ProductionBois',
        sourceId: b.id,
        module: 'verger',
        date: b.date.toISOString(),
        description: `Vente bois ${b.type} ${b.arbre?.nom || ''}`.trim(),
        quantite: b.volumeM3 || b.poidsKg,
        unite: b.volumeM3 ? 'm³' : 'kg',
        prixUnitaire: null,
        montant: b.prixVente || 0,
        client: null,
        paye: null,
        categorie: 'Bois',
      })
    })

    // Abattage -> revenus
    venteAbattage.forEach(a => {
      const nom = a.animal?.nom || a.lot?.nom ||
                  a.animal?.especeAnimale?.nom || a.lot?.especeAnimale?.nom || 'animal'
      revenues.push({
        id: `abattage-${a.id}`,
        source: 'Abattage',
        sourceId: a.id,
        module: 'elevage',
        date: a.date.toISOString(),
        description: `Vente viande ${nom}`,
        quantite: a.poidsCarcasse || a.quantite,
        unite: a.poidsCarcasse ? 'kg' : 'unité',
        prixUnitaire: null,
        montant: a.prixVente || 0,
        client: null,
        paye: null,
        categorie: 'Viande',
      })
    })

    // Recolte potager -> revenus
    recoltesPotager.forEach(r => {
      revenues.push({
        id: `recolte-potager-${r.id}`,
        source: 'Recolte',
        sourceId: r.id,
        module: 'potager',
        date: (r.dateVente || r.date).toISOString(),
        description: `Vente ${r.especeId}`,
        quantite: r.quantite,
        unite: 'kg',
        prixUnitaire: r.prixKg,
        montant: r.prixTotal || (r.quantite * (r.prixKg || 0)),
        client: r.clientNom,
        paye: true, // statut='vendu' implique payé
        categorie: 'Légumes',
      })
    })

    // VenteManuelle -> revenus
    ventesManuelles.forEach(v => {
      revenues.push({
        id: `manuel-${v.id}`,
        source: 'VenteManuelle',
        sourceId: v.id,
        module: v.module || 'autre',
        date: v.date.toISOString(),
        description: v.description,
        quantite: v.quantite,
        unite: v.unite,
        prixUnitaire: v.prixUnitaire,
        montant: v.montant,
        client: v.clientNom,
        paye: v.paye,
        categorie: v.categorie === 'legumes' ? 'Légumes' :
                   v.categorie === 'fruits' ? 'Fruits' :
                   v.categorie === 'transformation' ? 'Transformation' :
                   v.categorie === 'service' ? 'Service' : 'Autre',
      })
    })

    // CommandeBoutique livrées -> revenus
    commandesBoutique.forEach(c => {
      const description = c.lignes.length > 0
        ? `Commande boutique ${c.numero} : ${c.lignes.slice(0, 3).map(l => `${l.quantite} ${l.unite} ${l.nom}`).join(', ')}${c.lignes.length > 3 ? '...' : ''}`
        : `Commande boutique ${c.numero}`
      revenues.push({
        id: `boutique-${c.id}`,
        source: 'CommandeBoutique',
        sourceId: c.id,
        module: 'boutique',
        date: c.createdAt.toISOString(),
        description,
        quantite: null,
        unite: null,
        prixUnitaire: null,
        montant: c.total,
        client: c.clientNom,
        paye: true, // commande livrée = encaissée
        categorie: 'Boutique en ligne',
      })
    })

    // Filtrer par module si spécifié
    let filtered = revenues
    if (module) {
      filtered = revenues.filter(r => r.module === module)
    }

    // Trier par date décroissante
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Limiter
    const limited = filtered.slice(0, limit)

    // Total agrégé : on s'aligne sur la source unique de vérité (getKpiCompta).
    // L'ancien `filtered.reduce(...)` agrégeait les "sources brutes" potager
    // (recoltes vendues) + verger (recoltesArbres) + elevage (venteProduit) +
    // autres (venteManuelle) ; selon la couverture des doublons auto-compta,
    // le résultat divergeait du total exposé par /api/comptabilite/stats.
    // Désormais le total = VenteManuelle + LigneFacture (factures non
    // annulées), identique sur tous les écrans.
    const asOf = new Date()
    const kpiCompta = !module ? await getKpiCompta(userId, year, asOf) : null

    const stats = {
      // Total SSOT — autoritaire si pas de filtre module. Avec un filtre
      // module, on retombe sur le reduce local (le helper ne ventile pas
      // encore par module).
      total: kpiCompta ? kpiCompta.revenusYtd : filtered.reduce((sum, r) => sum + r.montant, 0),
      count: filtered.length,
      parModule: {
        potager: filtered.filter(r => r.module === 'potager').reduce((sum, r) => sum + r.montant, 0),
        verger: filtered.filter(r => r.module === 'verger').reduce((sum, r) => sum + r.montant, 0),
        elevage: filtered.filter(r => r.module === 'elevage').reduce((sum, r) => sum + r.montant, 0),
        boutique: filtered.filter(r => r.module === 'boutique').reduce((sum, r) => sum + r.montant, 0),
        autre: filtered.filter(r => r.module === 'autre').reduce((sum, r) => sum + r.montant, 0),
      },
      parCategorie: Object.entries(
        filtered.reduce((acc, r) => {
          acc[r.categorie] = (acc[r.categorie] || 0) + r.montant
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
    console.error('GET /api/comptabilite/revenus error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
