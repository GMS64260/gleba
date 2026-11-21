import { lotsReservesCaisse, lotsArticleCaisse, resteLot, atomesLot, consommerLotCaisse } from '@/lib/caisse/reservations'
import {verrouillerStockCommercial} from '@/lib/stocks/verrou-commercial'
import type { Prisma } from "@prisma/client"
import { finJourLivraison } from '@/lib/commercial/dates-stock'
import { randomUUID } from "node:crypto"
import {
  PRODUITS_RUCHE,
  UNITES_PRODUITS_RUCHE,
  type ProduitRuche,
  type UniteProduitRuche,
  typeVenteVersProduitRuche,
  uniteProduitRucheParDefaut,
} from "./produits-ruche"

const EPSILON = 1e-6
type TypeSortieStockRuche = 'vente' | 'autoconsommation' | 'don' | 'destruction' | 'transformation'

export class StockRucheError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message)
    this.name = "StockRucheError"
  }
}

export type StockRuche = {
  produit: ProduitRuche
  unite: UniteProduitRuche
  quantiteProduite: number
  sorti: number
  disponible: number
}

function facteurVersGrammes(unite: UniteProduitRuche) {
  return unite === "kg" ? 1000 : 1
}

export function convertirQuantiteProduitRuche(
  quantite: number,
  uniteSource: UniteProduitRuche,
  uniteCible: UniteProduitRuche,
) {
  return quantite * facteurVersGrammes(uniteSource) / facteurVersGrammes(uniteCible)
}

type ProductionAvecSorties = {
  produit: string
  unite: string
  quantite: number
  mouvementsStock: Array<{ quantite: number }>
}

export function calculerStocksRuche(productions: ProductionAvecSorties[]) {
  const stocks = new Map<ProduitRuche, StockRuche>()
  for (const production of productions) {
    if (!(PRODUITS_RUCHE as readonly string[]).includes(production.produit)) continue
    if (!(UNITES_PRODUITS_RUCHE as readonly string[]).includes(production.unite)) continue
    const produit = production.produit as ProduitRuche
    const uniteSource = production.unite as UniteProduitRuche
    const uniteCible = uniteProduitRucheParDefaut(produit)
    const courant = stocks.get(produit) ?? {
      produit,
      unite: uniteCible,
      quantiteProduite: 0,
      sorti: 0,
      disponible: 0,
    }
    courant.quantiteProduite += convertirQuantiteProduitRuche(
      production.quantite,
      uniteSource,
      uniteCible,
    )
    courant.sorti += convertirQuantiteProduitRuche(
      production.mouvementsStock.reduce(
        (somme, mouvement) => somme + mouvement.quantite,
        0,
      ),
      uniteSource,
      uniteCible,
    )
    courant.disponible = Math.max(0, courant.quantiteProduite - courant.sorti)
    stocks.set(produit, courant)
  }
  return [...stocks.values()].sort((a, b) =>
    a.produit.localeCompare(b.produit, "fr"),
  )
}

function quantiteFormatee(quantite: number) {
  return quantite.toLocaleString("fr-FR", { maximumFractionDigits: 3 })
}

export async function verrouillerStockRuche(
  tx: Prisma.TransactionClient,
  userId: string,
  produit: ProduitRuche,
) {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${`gleba:stock-ruche:${userId}:${produit}`})
    )
  `
}

async function ventilerSortieFifo(
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    produit: ProduitRuche
    unite: UniteProduitRuche
    date: Date
    quantite: number
    type: TypeSortieStockRuche
    venteProduitId?: number | null
    operationId: string
    notes?: string | null
    sessionCaisseId?: string
    caisseArticleId?: string
  },
) {
  if (!Number.isFinite(input.quantite) || input.quantite <= 0) {
    throw new StockRucheError("La quantité de sortie doit être positive.", 400)
  }
  await verrouillerStockCommercial(tx,input.userId)
  await verrouillerStockRuche(tx, input.userId, input.produit)

  if (input.venteProduitId) {
    await tx.mouvementStockRuche.deleteMany({
      where: { userId: input.userId, venteProduitId: input.venteProduitId },
    })
  }

  const facteurDemande = facteurVersGrammes(input.unite)
  const quantiteDemandeeGrammes = input.quantite * facteurDemande
  let restantGrammes = quantiteDemandeeGrammes
  const productions = await tx.productionRuche.findMany({
    where: {
      userId: input.userId,
      produit: input.produit,
      date: { lte: finJourLivraison(input.date) },
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    include: { mouvementsStock: { select: { quantite: true } } },
  })

  const reserves = await lotsReservesCaisse(tx, input.userId, input.sessionCaisseId)
  if (input.sessionCaisseId && !input.caisseArticleId) throw new StockRucheError('Identifiez le produit affecté à cette caisse.', 400)
  const propres = input.sessionCaisseId ? await lotsArticleCaisse(tx, input.userId, input.sessionCaisseId, input.caisseArticleId!) : null

  for (const production of productions) {
    if (restantGrammes <= EPSILON) break
    if (!(UNITES_PRODUITS_RUCHE as readonly string[]).includes(production.unite)) continue
    const uniteProduction = production.unite as UniteProduitRuche
    const facteurProduction = facteurVersGrammes(uniteProduction)
    const dejaSorti = production.mouvementsStock.reduce(
      (somme, mouvement) => somme + mouvement.quantite,
      0,
    )
    const reserve = reserves.filter(l => l.rucheId === production.id).reduce((q, l) => q + resteLot(l), 0)
    const propre = propres?.find(l => l.rucheId === production.id)
    if (propres && !propre) continue
    const physiqueDisponible = Math.max(
      0,
      (production.quantite - dejaSorti - reserve) * facteurProduction,
    )
    const disponibleGrammes = propre ? Math.min(physiqueDisponible, resteLot(propre) * facteurProduction) : physiqueDisponible
    if (disponibleGrammes <= EPSILON) continue

    const sortieGrammes = Math.min(disponibleGrammes, restantGrammes)
    // Un mouvement est toujours exprimé dans l'unité de sa récolte source.
    const quantite = sortieGrammes / facteurProduction
    await tx.mouvementStockRuche.create({
      data: {
        userId: input.userId,
        productionId: production.id,
        venteProduitId: input.venteProduitId ?? null,
        operationId: input.operationId,
        date: input.date,
        type: input.type,
        quantite,
        notes: input.notes ?? null,
      },
    })
    if (propre) await consommerLotCaisse(tx, input.userId, propre.id, atomesLot(quantite, uniteProduction))
    restantGrammes -= sortieGrammes
  }

  if (restantGrammes > EPSILON) {
    const disponible = Math.max(
      0,
      (quantiteDemandeeGrammes - restantGrammes) / facteurDemande,
    )
    throw new StockRucheError(
      `Stock de ${input.produit.replaceAll("_", " ")} insuffisant : ` +
      `${quantiteFormatee(disponible)} ${input.unite} disponible(s), ` +
      `${quantiteFormatee(input.quantite)} ${input.unite} demandé(s).`,
    )
  }
}

export async function synchroniserStockRucheVente(
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    venteId: number
    type: string
    date: Date
    quantite: number
    unite: string
  },
) {
  const produit = typeVenteVersProduitRuche(input.type)
  if (!produit) return false
  if (!(UNITES_PRODUITS_RUCHE as readonly string[]).includes(input.unite)) {
    throw new StockRucheError(
      "Une vente de produit de la ruche doit être exprimée en kg ou en g.",
      400,
    )
  }
  await ventilerSortieFifo(tx, {
    userId: input.userId,
    produit,
    unite: input.unite as UniteProduitRuche,
    date: input.date,
    quantite: input.quantite,
    type: "vente",
    venteProduitId: input.venteId,
    operationId: `vente:${input.venteId}`,
    notes: `Sortie automatique depuis Production > Ventes (vente #${input.venteId})`,
  })
  return true
}

export async function sortirStockRuche(
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    produit: ProduitRuche
    unite: UniteProduitRuche
    date: Date
    quantite: number
    type: TypeSortieStockRuche
    notes?: string | null
    sessionCaisseId?: string
    caisseArticleId?: string
  },
) {
  const operationId = randomUUID()
  await ventilerSortieFifo(tx, { ...input, operationId })
  return operationId
}

export async function supprimerStockRucheVente(
  tx: Prisma.TransactionClient,
  userId: string,
  venteId: number,
) {
  await tx.mouvementStockRuche.deleteMany({
    where: { userId, venteProduitId: venteId },
  })
}
