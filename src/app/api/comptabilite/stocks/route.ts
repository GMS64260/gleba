/**
 * API Stocks unifiés (multi-tenancy via UserStock*)
 * GET /api/comptabilite/stocks
 * Vue consolidée de tous les stocks de tous les modules
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { calculerStockOeufs } from '@/lib/stocks-helpers'
import { computeStocksTotaux, moyennePrix } from '@/lib/stocks/agregation'

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
      // Potager recoltes en stock
      recoltesEnStock,
      // BUG #8 — Potager cultures en cours (stock vivant en germination)
      culturesActives,
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

      // BUG #8 (QA Camille 2026-05-15) — Cultures Maraîchage actives non
      // encore récoltées : on les remonte comme « stock en cours » pour
      // que la card Maraîchage ne soit pas vide tant qu'aucune Recolte
      // n'a été saisie. La QA attend que 12 planches / 19 cultures soient
      // visibles côté Stocks ; sinon le compteur M = 0 alors qu'il y a
      // de l'activité.
      // Définition partagée avec Dev 2 (#2 Dashboard Maraîchage) :
      // « culture active » = terminee=null + (semisFait OR plantationFaite)
      // + recolteFaite=false. Avec ce filtre on évite les cultures
      // déjà clôturées et celles qui n'ont pas démarré.
      prisma.culture.findMany({
        where: {
          userId,
          terminee: null,
          recolteFaite: false,
          OR: [{ semisFait: true }, { plantationFaite: true }],
        },
        select: {
          id: true,
          plancheId: true,
          quantite: true,
          espece: { select: { id: true, rendement: true } },
          variete: { select: { id: true } },
          planche: { select: { surface: true, largeur: true, longueur: true, nom: true } },
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

      // Stock œufs calculé
      calculerStockOeufs(userId),

      // Arbres actifs
      prisma.arbre.groupBy({
        by: ['type'],
        where: { userId, etat: { not: 'mort' } },
        _count: true,
      }),

      // Fruits en stock (recoltes arbres)
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

    // BUG #7 — Prix moyens récents (90 j) pour valoriser les stocks qui
    // n'ont pas de prix saisi (récoltes vendues, œufs, fruits). Sans ça,
    // la card « Valeur estimée » restait à 0 dès qu'un utilisateur n'avait
    // pas pris la peine de remplir le prix unitaire sur chaque saisie.
    const ilYAQuatreVingtDixJours = new Date(Date.now() - 90 * 24 * 3600 * 1000)
    const [ventesRecoltes, ventesFruits, ventesOeufs] = await Promise.all([
      prisma.recolte.findMany({
        where: { userId, statut: 'vendu', dateVente: { gte: ilYAQuatreVingtDixJours }, prixKg: { not: null, gt: 0 } },
        select: { especeId: true, prixKg: true },
      }),
      prisma.recolteArbre.findMany({
        where: { userId, statut: 'vendu', dateVente: { gte: ilYAQuatreVingtDixJours }, prixKg: { not: null, gt: 0 } },
        select: { arbreId: true, prixKg: true },
      }),
      prisma.venteProduit.findMany({
        where: { userId, type: 'oeufs', date: { gte: ilYAQuatreVingtDixJours }, annule: false },
        select: { quantite: true, unite: true, prixUnitaire: true },
      }),
    ])

    // Map especeId → prix moyen €/kg (récoltes potager)
    const prixParEspece = new Map<string, number[]>()
    for (const v of ventesRecoltes) {
      if (!v.prixKg) continue
      const list = prixParEspece.get(v.especeId) ?? []
      list.push(v.prixKg)
      prixParEspece.set(v.especeId, list)
    }
    // Map arbreId → prix moyen €/kg (fruits arbres)
    const prixParArbre = new Map<number, number[]>()
    for (const v of ventesFruits) {
      if (!v.prixKg) continue
      const list = prixParArbre.get(v.arbreId) ?? []
      list.push(v.prixKg)
      prixParArbre.set(v.arbreId, list)
    }
    // Prix moyen œuf à l'unité (douzaine → /12)
    const prixOeufUnit = moyennePrix(
      ventesOeufs.map((v) =>
        v.unite === 'douzaine' ? v.prixUnitaire / 12 : v.prixUnitaire
      )
    )

    // Récupérer les noms des especes animales
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

    // Récoltes potager en stock (agrégées par espece)
    // BUG #7 : fallback sur prix moyen des ventes récentes si pas de prixKg.
    const recoltesParEspece = new Map<string, { nom: string; totalKg: number; valeur: number; hasPrix: boolean }>()
    recoltesEnStock.forEach(r => {
      const key = r.especeId
      const existing = recoltesParEspece.get(key)
      const prixFallback = r.prixKg ?? moyennePrix(prixParEspece.get(r.especeId) ?? []) ?? 0
      const val = r.quantite * prixFallback
      const hasPrix = prixFallback > 0
      if (existing) {
        existing.totalKg += r.quantite
        existing.valeur += val
        existing.hasPrix = existing.hasPrix || hasPrix
      } else {
        recoltesParEspece.set(key, {
          nom: r.espece?.id || key,
          totalKg: r.quantite,
          valeur: val,
          hasPrix,
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
        valeur: data.hasPrix ? data.valeur : null,
      })
    })

    // BUG #8 — Cultures Maraîchage en cours, agrégées par espèce.
    // Estimation théorique du stock à venir = surface × rendement (kg/m²).
    // Le tooltip côté UI dit « X cultures actives sur Y planches » pour
    // que l'utilisateur ne confonde pas avec du stock réellement en main.
    interface CultureAcc {
      nom: string
      nbCultures: number
      planches: Set<string>
      stockEstime: number
      valeurEstimee: number
      hasPrix: boolean
    }
    const culturesParEspece = new Map<string, CultureAcc>()
    for (const c of culturesActives) {
      if (!c.espece?.id) continue
      const key = c.espece.id
      const surface =
        c.planche?.surface ??
        (c.planche?.largeur && c.planche?.longueur
          ? c.planche.largeur * c.planche.longueur
          : 0)
      const rendement = c.espece.rendement ?? 0
      const estimeKg = surface * rendement
      const prixMoyen = moyennePrix(prixParEspece.get(key) ?? []) ?? 0
      const valeur = estimeKg * prixMoyen
      const existing = culturesParEspece.get(key)
      if (existing) {
        existing.nbCultures += 1
        if (c.plancheId) existing.planches.add(c.plancheId)
        existing.stockEstime += estimeKg
        existing.valeurEstimee += valeur
        existing.hasPrix = existing.hasPrix || prixMoyen > 0
      } else {
        culturesParEspece.set(key, {
          nom: c.espece.id,
          nbCultures: 1,
          planches: new Set(c.plancheId ? [c.plancheId] : []),
          stockEstime: estimeKg,
          valeurEstimee: valeur,
          hasPrix: prixMoyen > 0,
        })
      }
    }
    culturesParEspece.forEach((acc, especeId) => {
      const stockArrondi = Math.round(acc.stockEstime * 10) / 10
      stocks.push({
        id: `culture-active-${especeId}`,
        module: 'potager',
        categorie: 'Cultures en cours',
        nom: `${acc.nom} (${acc.nbCultures} culture${acc.nbCultures > 1 ? 's' : ''} · ${acc.planches.size} planche${acc.planches.size > 1 ? 's' : ''})`,
        stock: stockArrondi > 0 ? stockArrondi : acc.nbCultures,
        unite: stockArrondi > 0 ? 'kg estimés' : 'cultures',
        stockMin: null,
        alerteBas: false,
        valeur: acc.hasPrix ? Math.round(acc.valeurEstimee * 100) / 100 : null,
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

    // Animaux individuels par espece
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

    // Stock œufs
    // BUG #7 : valoriser avec prix moyen unitaire récent (ventes 90 j).
    if (stockOeufs.stockNet > 0 || stockOeufs.detail.produits > 0) {
      const valeurOeufs = prixOeufUnit ? stockOeufs.stockNet * prixOeufUnit : null
      stocks.push({
        id: 'oeufs-stock',
        module: 'elevage',
        categorie: 'Oeufs',
        nom: 'Stock œufs',
        stock: stockOeufs.stockNet,
        unite: 'oeufs',
        stockMin: 24,
        alerteBas: stockOeufs.stockNet < 24,
        valeur: valeurOeufs,
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

    // Fruits en stock (recoltes arbres agrégées par arbre)
    // BUG #7 : fallback sur prix moyen €/kg des ventes récentes par arbre.
    const fruitsParArbre = new Map<number, { nom: string; totalKg: number; valeur: number; hasPrix: boolean }>()
    fruitsEnStock.forEach(r => {
      const key = r.arbreId
      const existing = fruitsParArbre.get(key)
      const prixFallback = r.prixKg ?? moyennePrix(prixParArbre.get(r.arbreId) ?? []) ?? 0
      const val = r.quantite * prixFallback
      const hasPrix = prixFallback > 0
      if (existing) {
        existing.totalKg += r.quantite
        existing.valeur += val
        existing.hasPrix = existing.hasPrix || hasPrix
      } else {
        fruitsParArbre.set(key, {
          nom: r.arbre?.nom || `Arbre #${key}`,
          totalKg: r.quantite,
          valeur: val,
          hasPrix,
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
        valeur: data.hasPrix ? data.valeur : null,
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
    // BUG #7 : on utilise le sélecteur testé `computeStocksTotaux` au lieu
    // d'un reduce inline. Il calcule simultanément `valeurTotale`,
    // `valeurParModule` (pour le tooltip de la card) et `itemsParModule`.
    const alertes = stocks.filter(s => s.alerteBas)
    const totaux = computeStocksTotaux(stocks)
    const stats = {
      totalItems: stocks.length,
      alertes: alertes.length,
      valeurTotale: totaux.valeurTotale,
      valeurParModule: totaux.valeurParModule,
      parModule: totaux.itemsParModule,
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
