/**
 * Stocks unifiés multi-modules — source unique de vérité de l'écran
 * Comptabilité > Stocks (les 11 catégories : graines, plants, fertilisants,
 * récoltes en stock, cultures en cours, aliments, animaux individuels, lots,
 * œufs, produits de la ruche, arbres, fruits et bois).
 *
 * Extrait de GET /api/comptabilite/stocks (lot assistant 2026-08-11) pour être
 * partagé avec l'outil assistant `get_stocks_valorises` : le « stock actuel »
 * cité par l'assistant doit couvrir les mêmes items que l'écran (35 = 35),
 * jamais un sous-ensemble.
 */

import prisma from '@/lib/prisma'
import { calculerStockOeufs, OEUFS_PAR_UNITE } from '@/lib/stocks-helpers'
import { arrondiQuantiteStock, computeStocksTotaux, moyennePrix } from '@/lib/stocks/agregation'
import { surfaceCultureM2 } from '@/lib/culture-surface'
import { prixReferenceKg, PRIX_REF_OEUF_UNITAIRE } from '@/lib/stocks/prix-reference'
import {
  calculerStocksRuche,
  convertirQuantiteProduitRuche,
} from '@/lib/elevage/stock-ruche'
import {
  PRODUITS_RUCHE_LABELS,
  TYPES_VENTE_PRODUITS_RUCHE,
  type ProduitRuche,
  type UniteProduitRuche,
  typeVenteVersProduitRuche,
} from '@/lib/elevage/produits-ruche'

export interface StockUnifieItem {
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

export type StocksUnifies = Awaited<ReturnType<typeof computeStocksUnifies>>

export async function computeStocksUnifies(userId: string) {

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
    // Produits de la ruche : récoltes moins sorties
    productionsRuche,
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
        espece: { select: { id: true, nom: true, prixKg: true } },
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
        longueur: true,
        espece: { select: { id: true, nom: true, rendement: true, prixKg: true } },
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

    prisma.productionRuche.findMany({
      where: { userId },
      select: {
        produit: true,
        unite: true,
        quantite: true,
        mouvementsStock: { select: { quantite: true } },
      },
    }),

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
  const [ventesRecoltes, ventesFruits, ventesOeufs, ventesRuche] = await Promise.all([
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
    prisma.venteProduit.findMany({
      where: {
        userId,
        type: { in: [...TYPES_VENTE_PRODUITS_RUCHE] },
        date: { gte: ilYAQuatreVingtDixJours },
        annule: false,
        prixUnitaire: { gt: 0 },
      },
      select: { type: true, unite: true, prixUnitaire: true },
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
  // QA 2026-05-15 — Bug #12 : fallback barème de référence si pas
  // de vente observée (cf lib/stocks/prix-reference.ts). Sans ça,
  // la démo affichait "2 268 œufs · 0 €".
  // QA cmsjioqg — le prix unitaire d'une vente est libellé PAR UNITÉ DE
  // VENTE (douzaine, boîte de 6, plaque de 30…), pas par œuf. Ne diviser que
  // pour la douzaine surévaluait le stock : une boîte à 3,20 € était comptée
  // 3,20 €/œuf, et une saisie aberrante (86,40 € « l'unité ») portait la
  // moyenne à 24 €/œuf → 7 659 œufs valorisés 183 816 €. On ramène chaque
  // prix au prix/œuf selon l'unité (constante partagée avec le décompte de
  // stock), et on écarte les valeurs implausibles (data-entry) avant la
  // moyenne.
  const PRIX_OEUF_MAX_PLAUSIBLE = PRIX_REF_OEUF_UNITAIRE * 10 // 4,50 €/œuf : au-delà = erreur de saisie
  const prixOeufUnit =
    moyennePrix(
      ventesOeufs
        .map((v) => {
          const parUnite = OEUFS_PAR_UNITE[(v.unite || '').trim().toLowerCase()] ?? 1
          return v.prixUnitaire / parUnite
        })
        .filter((prixParOeuf) => prixParOeuf > 0 && prixParOeuf <= PRIX_OEUF_MAX_PLAUSIBLE)
    ) ?? PRIX_REF_OEUF_UNITAIRE

  const stocksRuche = calculerStocksRuche(productionsRuche)
  const prixRucheParProduit = new Map<ProduitRuche, number[]>()
  for (const vente of ventesRuche) {
    const produit = typeVenteVersProduitRuche(vente.type)
    const stock = produit ? stocksRuche.find((item) => item.produit === produit) : null
    if (!produit || !stock || (vente.unite !== 'kg' && vente.unite !== 'g')) continue
    const quantiteDansUniteStock = convertirQuantiteProduitRuche(
      1,
      vente.unite as UniteProduitRuche,
      stock.unite,
    )
    if (quantiteDansUniteStock <= 0) continue
    const prix = vente.prixUnitaire / quantiteDansUniteStock
    const prixExistants = prixRucheParProduit.get(produit) ?? []
    prixExistants.push(prix)
    prixRucheParProduit.set(produit, prixExistants)
  }

  // Récupérer les noms des especes animales
  const especeAnimaleIds = animauxActifs.map(a => a.especeAnimaleId)
  const especesAnimales = await prisma.especeAnimale.findMany({
    where: { id: { in: especeAnimaleIds } },
    select: { id: true, nom: true },
  })
  const especeAnimaleMap = new Map(especesAnimales.map(e => [e.id, e.nom]))

  // Transformer en format unifié
  const stocks: StockUnifieItem[] = []

  // === POTAGER ===

  // Variétés -> stocks graines (per-user)
  userVarietes.forEach(uv => {
    if (uv.stockGraines && uv.stockGraines > 0) {
      stocks.push({
        id: `variete-graines-${uv.varieteId}`,
        module: 'potager',
        categorie: 'Graines',
        nom: `${uv.variete.nom ?? uv.variete.id} (${uv.variete.espece.nom ?? uv.variete.espece.id})`,
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
        nom: `${uv.variete.nom ?? uv.variete.id} (${uv.variete.espece.nom ?? uv.variete.espece.id})`,
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
  // BUG #7 : fallback prix moyen des ventes récentes si pas de prixKg.
  // QA 2026-05-15 — Bug #12 : ajout d'un 3e niveau de fallback sur
  // le barème de référence (lib prix-reference.ts) pour ne plus
  // afficher 0 € sur les stocks d'espèces sans historique de vente.
  const recoltesParEspece = new Map<string, { nom: string; totalKg: number; valeur: number; hasPrix: boolean }>()
  recoltesEnStock.forEach(r => {
    const key = r.especeId
    const existing = recoltesParEspece.get(key)
    const prixFallback =
      r.prixKg
      ?? moyennePrix(prixParEspece.get(r.especeId) ?? [])
      ?? r.espece?.prixKg
      ?? prixReferenceKg(r.especeId)
      ?? 0
    const val = r.quantite * prixFallback
    const hasPrix = prixFallback > 0
    if (existing) {
      existing.totalKg += r.quantite
      existing.valeur += val
      existing.hasPrix = existing.hasPrix || hasPrix
    } else {
      recoltesParEspece.set(key, {
        nom: r.espece?.nom ?? r.espece?.id ?? key,
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
    // QA cmswu7zfb — surface de la CULTURE (longueur cultivée prioritaire),
    // pas de la planche entière : le stock prévisionnel doublait pour une
    // culture n'occupant que la moitié de sa planche.
    const surface = surfaceCultureM2({ longueur: c.longueur, planche: c.planche })
    const rendement = c.espece.rendement ?? 0
    const estimeKg = surface * rendement
    // QA 2026-05-15 — Bug #12 : 3 niveaux de fallback (ventes
    // observées → barème de référence) pour éviter "0 €" parasite.
    // Feedback cmpkyfjyx — Ajout du prix_kg saisi sur l'espèce comme
    // 1er fallback (avant le barème générique) car des espèces composées
    // comme "Courge butternut" ont leur prix en base mais ne matchent
    // pas le barème ("Courge"/"Butternut" sont des entrées séparées).
    const prixMoyen =
      moyennePrix(prixParEspece.get(key) ?? [])
      ?? c.espece.prixKg
      ?? prixReferenceKg(key)
      ?? 0
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
        nom: c.espece.nom ?? c.espece.id,
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

  // Produits de la ruche : stock physique issu du journal FIFO. La valeur
  // reste une estimation au prix moyen des ventes des 90 derniers jours ;
  // elle est absente sans historique plutôt que remplacée par un faux barème.
  for (const stock of stocksRuche) {
    if (stock.disponible <= 0 && stock.quantiteProduite <= 0) continue
    const prixMoyen = moyennePrix(prixRucheParProduit.get(stock.produit) ?? [])
    stocks.push({
      id: `ruche-${stock.produit}`,
      module: 'elevage',
      categorie: 'Produits de la ruche',
      nom: PRODUITS_RUCHE_LABELS[stock.produit],
      stock: Math.round(stock.disponible * 1000) / 1000,
      unite: stock.unite,
      stockMin: null,
      alerteBas: false,
      valeur: prixMoyen === null
        ? null
        : Math.round(stock.disponible * prixMoyen * 100) / 100,
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
    // QA 2026-05-15 — Bug #12 : fallback barème par espèce d'arbre
    // (Pommier, Poirier…) si pas de vente observée pour cet arbre.
    const prixFallback =
      r.prixKg
      ?? moyennePrix(prixParArbre.get(r.arbreId) ?? [])
      ?? prixReferenceKg(r.arbre?.espece ?? null)
      ?? 0
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
  // QA cmsqlr6jb — une quantité affichée ne porte jamais la bavure du flottant.
  // Normalisé ici, sur la SSOT : l'écran, GET /api/comptabilite/stocks et
  // l'outil assistant `get_stocks_valorises` en héritent d'un seul coup.
  // `valeur` n'est pas touchée (calculée sur les quantités brutes, arrondie par
  // computeStocksTotaux puis par formatEuro à l'affichage).
  for (const item of stocks) item.stock = arrondiQuantiteStock(item.stock)

  const alertes = stocks.filter(s => s.alerteBas)
  const totaux = computeStocksTotaux(stocks)
  const stats = {
    totalItems: stocks.length,
    alertes: alertes.length,
    valeurTotale: totaux.valeurTotale,
    valeurParModule: totaux.valeurParModule,
    parModule: totaux.itemsParModule,
  }

  // Bug cmp8sqkh2 (Marc 2026-05-16) — conciliation Récoltes potager
  // (dashboard KPI ≠ Stocks). On expose les agrégats par statut pour que
  // l'UI puisse afficher "X récolté = Y en stock + Z vendu/donné + perte".
  const year = new Date().getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31, 23, 59, 59)
  const recoltesParStatut = await prisma.recolte.groupBy({
    by: ['statut'],
    where: { userId, date: { gte: startOfYear, lte: endOfYear } },
    _sum: { quantite: true },
  })
  const reconciliationPotager: Record<string, number> = {}
  let totalRecoltesAnnee = 0
  for (const r of recoltesParStatut) {
    const q = r._sum.quantite ?? 0
    reconciliationPotager[r.statut] = q
    totalRecoltesAnnee += q
  }
  return {
    data: stocks,
    alertes,
    stats,
    reconciliationPotager: {
      annee: year,
      totalRecoltesAnnee,
      parStatut: reconciliationPotager,
    },
  }
}
