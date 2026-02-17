/**
 * API Stocks unifiés (multi-tenancy via UserStock*)
 * GET /api/comptabilite/stocks
 * Vue consolidée de tous les stocks de tous les modules
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { calculerStockOeufs } from '@/lib/stocks-helpers'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id

    // Récupérer tous les stocks (per-user via UserStock*)
    const [
      // Potager (per-user)
      userVarietes,
      userFertilisants,
      // Potager récoltes en stock
      recoltesEnStock,
      // Élevage (per-user)
      userAliments,
      animauxActifs,
      lotsActifs,
      // Élevage oeufs
      stockOeufs,
      // Verger
      arbresActifs,
      fruitsEnStock,
      boisEnStock,
    ] = await Promise.all([
      // Variétés avec stock per-user
      prisma.userStockVariete.findMany({
        where: {
          userId,
          OR: [
            { stockGraines: { gt: 0 } },
            { stockPlants: { gt: 0 } },
          ],
        },
        include: {
          variete: {
            include: { espece: true },
          },
        },
        orderBy: { varieteId: 'asc' },
      }),

      // Fertilisants avec stock per-user
      prisma.userStockFertilisant.findMany({
        where: {
          userId,
          stock: { gt: 0 },
        },
        include: {
          fertilisant: true,
        },
        orderBy: { fertilisantId: 'asc' },
      }),

      // Récoltes potager en stock
      prisma.recolte.findMany({
        where: { userId, statut: 'en_stock' },
        include: {
          espece: { select: { id: true } },
        },
      }),

      // Aliments avec stock per-user
      prisma.userStockAliment.findMany({
        where: {
          userId,
          stock: { gt: 0 },
        },
        include: {
          aliment: true,
        },
        orderBy: { aliment: { nom: 'asc' } },
      }),

      // Animaux actifs
      prisma.animal.groupBy({
        by: ['especeAnimaleId'],
        where: { userId, statut: 'actif' },
        _count: true,
      }),

      // Lots actifs avec quantité
      prisma.lotAnimaux.findMany({
        where: { userId, statut: 'actif' },
        include: {
          especeAnimale: { select: { nom: true } },
        },
      }),

      // Stock oeufs calculé
      calculerStockOeufs(userId),

      // Arbres actifs
      prisma.arbre.groupBy({
        by: ['type'],
        where: { userId, etat: { not: 'mort' } },
        _count: true,
      }),

      // Fruits en stock (récoltes arbres)
      prisma.recolteArbre.findMany({
        where: { userId, statut: 'en_stock' },
        include: {
          arbre: { select: { id: true, nom: true, type: true, espece: true } },
        },
      }),

      // Bois en stock
      prisma.productionBois.findMany({
        where: { userId, statut: 'en_stock' },
        include: {
          arbre: { select: { id: true, nom: true } },
        },
      }),
    ])

    // Récupérer les noms des espèces animales
    const especeAnimaleIds = animauxActifs.map(a => a.especeAnimaleId)
    const especesAnimales = await prisma.especeAnimale.findMany({
      where: { id: { in: especeAnimaleIds } },
      select: { id: true, nom: true },
    })
    const especeAnimaleMap = new Map(especesAnimales.map(e => [e.id, e.nom]))

    // Transformer en format unifié
    type StockItem = {
      id: string
      module: string
      categorie: string
      nom: string
      stock: number
      unite: string
      stockMin: number | null
      alerteBas: boolean
      valeur: number | null
    }

    const stocks: StockItem[] = []

    // === POTAGER ===

    // Variétés -> stocks graines (per-user)
    userVarietes.forEach(uv => {
      if (uv.stockGraines && uv.stockGraines > 0) {
        stocks.push({
          id: `variete-graines-${uv.varieteId}`,
          module: 'potager',
          categorie: 'Graines',
          nom: `${uv.variete.id} (${uv.variete.espece.id})`,
          stock: uv.stockGraines,
          unite: 'g',
          stockMin: 100,
          alerteBas: uv.stockGraines < 100,
          valeur: uv.variete.prixGraine ? uv.stockGraines * uv.variete.prixGraine / 1000 : null,
        })
      }
      if (uv.stockPlants && uv.stockPlants > 0) {
        stocks.push({
          id: `variete-plants-${uv.varieteId}`,
          module: 'potager',
          categorie: 'Plants',
          nom: `${uv.variete.id} (${uv.variete.espece.id})`,
          stock: uv.stockPlants,
          unite: 'plants',
          stockMin: 10,
          alerteBas: uv.stockPlants < 10,
          valeur: null,
        })
      }
    })

    // Fertilisants -> stocks (per-user)
    userFertilisants.forEach(uf => {
      stocks.push({
        id: `fertilisant-${uf.fertilisantId}`,
        module: 'potager',
        categorie: 'Fertilisants',
        nom: uf.fertilisant.id,
        stock: uf.stock || 0,
        unite: 'kg',
        stockMin: 10,
        alerteBas: (uf.stock || 0) < 10,
        valeur: uf.prix ? (uf.stock || 0) * uf.prix : null,
      })
    })

    // Récoltes potager en stock (agrégées par espèce)
    const recoltesParEspece = new Map<string, { nom: string; totalKg: number; valeur: number }>()
    recoltesEnStock.forEach(r => {
      const key = r.especeId
      const existing = recoltesParEspece.get(key)
      const val = r.prixKg ? r.quantite * r.prixKg : 0
      if (existing) {
        existing.totalKg += r.quantite
        existing.valeur += val
      } else {
        recoltesParEspece.set(key, {
          nom: r.espece?.id || key,
          totalKg: r.quantite,
          valeur: val,
        })
      }
    })
    recoltesParEspece.forEach((data, especeId) => {
      stocks.push({
        id: `recolte-potager-${especeId}`,
        module: 'potager',
        categorie: 'Récoltes en stock',
        nom: data.nom,
        stock: data.totalKg,
        unite: 'kg',
        stockMin: null,
        alerteBas: false,
        valeur: data.valeur || null,
      })
    })

    // === ÉLEVAGE ===

    // Aliments -> stocks (per-user)
    userAliments.forEach(ua => {
      const alerteBas = ua.stockMin !== null && ua.stock !== null && ua.stock <= ua.stockMin
      stocks.push({
        id: `aliment-${ua.alimentId}`,
        module: 'elevage',
        categorie: 'Aliments',
        nom: ua.aliment.nom,
        stock: ua.stock || 0,
        unite: 'kg',
        stockMin: ua.stockMin,
        alerteBas,
        valeur: ua.prix ? (ua.stock || 0) * ua.prix : null,
      })
    })

    // Animaux individuels par espèce
    animauxActifs.forEach(a => {
      stocks.push({
        id: `animaux-${a.especeAnimaleId}`,
        module: 'elevage',
        categorie: 'Animaux individuels',
        nom: especeAnimaleMap.get(a.especeAnimaleId) || a.especeAnimaleId,
        stock: a._count,
        unite: 'têtes',
        stockMin: null,
        alerteBas: false,
        valeur: null,
      })
    })

    // Lots d'animaux
    lotsActifs.forEach(l => {
      stocks.push({
        id: `lot-${l.id}`,
        module: 'elevage',
        categorie: 'Lots animaux',
        nom: l.nom || l.especeAnimale.nom,
        stock: l.quantiteActuelle,
        unite: 'têtes',
        stockMin: null,
        alerteBas: false,
        valeur: null,
      })
    })

    // Stock oeufs
    if (stockOeufs.stockNet > 0 || stockOeufs.detail.produits > 0) {
      stocks.push({
        id: 'oeufs-stock',
        module: 'elevage',
        categorie: 'Oeufs',
        nom: 'Stock oeufs',
        stock: stockOeufs.stockNet,
        unite: 'oeufs',
        stockMin: 24,
        alerteBas: stockOeufs.stockNet < 24,
        valeur: null,
      })
    }

    // === VERGER ===

    // Arbres par type
    const typeLabels: Record<string, string> = {
      fruitier: 'Fruitiers',
      petit_fruit: 'Petits fruits',
      forestier: 'Forestiers',
      ornement: 'Ornementaux',
      haie: 'Haies',
    }
    arbresActifs.forEach(a => {
      stocks.push({
        id: `arbres-${a.type}`,
        module: 'verger',
        categorie: 'Arbres',
        nom: typeLabels[a.type] || a.type,
        stock: a._count,
        unite: 'arbres',
        stockMin: null,
        alerteBas: false,
        valeur: null,
      })
    })

    // Fruits en stock (récoltes arbres agrégées par arbre)
    const fruitsParArbre = new Map<number, { nom: string; totalKg: number; valeur: number }>()
    fruitsEnStock.forEach(r => {
      const key = r.arbreId
      const existing = fruitsParArbre.get(key)
      const val = r.prixKg ? r.quantite * r.prixKg : 0
      if (existing) {
        existing.totalKg += r.quantite
        existing.valeur += val
      } else {
        fruitsParArbre.set(key, {
          nom: r.arbre?.nom || `Arbre #${key}`,
          totalKg: r.quantite,
          valeur: val,
        })
      }
    })
    fruitsParArbre.forEach((data, arbreId) => {
      stocks.push({
        id: `fruits-${arbreId}`,
        module: 'verger',
        categorie: 'Fruits en stock',
        nom: data.nom,
        stock: data.totalKg,
        unite: 'kg',
        stockMin: null,
        alerteBas: false,
        valeur: data.valeur || null,
      })
    })

    // Bois en stock
    boisEnStock.forEach(b => {
      const volume = b.volumeM3 || 0
      stocks.push({
        id: `bois-${b.id}`,
        module: 'verger',
        categorie: 'Bois en stock',
        nom: b.arbre?.nom || `Arbre #${b.arbreId}`,
        stock: volume,
        unite: 'm³',
        stockMin: null,
        alerteBas: false,
        valeur: b.prixVente || null,
      })
    })

    // Stats
    const alertes = stocks.filter(s => s.alerteBas)
    const stats = {
      totalItems: stocks.length,
      alertes: alertes.length,
      valeurTotale: stocks.reduce((sum, s) => sum + (s.valeur || 0), 0),
      parModule: {
        potager: stocks.filter(s => s.module === 'potager').length,
        verger: stocks.filter(s => s.module === 'verger').length,
        elevage: stocks.filter(s => s.module === 'elevage').length,
      },
    }

    return NextResponse.json({
      data: stocks,
      alertes,
      stats,
    })
  } catch (error) {
    console.error('GET /api/comptabilite/stocks error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
