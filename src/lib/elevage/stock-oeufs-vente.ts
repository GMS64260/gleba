import type { Prisma } from "@prisma/client"
import { OEUFS_PAR_UNITE, oeufsDepuisUnite } from "@/lib/stocks-helpers"
import { statutLotOeufs, stockRestantLotOeufs } from "./stock-oeufs"
import { blocagesVetoPontes } from "./stock-oeufs-lots"

export class StockOeufsVenteError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message)
    this.name = "StockOeufsVenteError"
  }
}

export function quantiteOeufsVendus(quantite: number, unite: string): number {
  // QA cmsnokro7 — cette table locale n'acceptait que douzaine/unité alors
  // que le référentiel partagé (OEUFS_PAR_UNITE, stocks-helpers) en connaît
  // sept : une vente en « boîte »/« plaque »/« plateau » était rejetée en 400
  // et le registre par lot divergeait du stock global. Une seule conversion.
  const uniteNormalisee = unite.trim().toLowerCase().replace(/s$/, "")
  const connue =
    uniteNormalisee in OEUFS_PAR_UNITE ||
    uniteNormalisee === "unité" ||
    uniteNormalisee === "douzaine"
  const brut = connue ? oeufsDepuisUnite(quantite, uniteNormalisee === "unité" ? "unite" : uniteNormalisee) : Number.NaN
  const arrondi = Math.round(brut)
  if (!Number.isFinite(brut) || brut <= 0 || Math.abs(brut - arrondi) > 1e-6) {
    throw new StockOeufsVenteError(
      "Une vente d’œufs doit être exprimée en œufs entiers (unité, demi-douzaine, boîte, douzaine, plaque, plateau).",
      400,
    )
  }
  return arrondi
}

export function marqueurVenteOeufs(venteId: number): string {
  return `[vente-produit:${venteId}]`
}

/**
 * Reconstitue les sorties de stock d'une vente d'œufs en FIFO sur les lots
 * encore commercialisables à la date de vente.
 */
export async function synchroniserStockOeufsVente(
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    venteId: number
    date: Date
    quantite: number
    unite: string
  },
): Promise<number> {
  const marqueur = marqueurVenteOeufs(input.venteId)
  await tx.mouvementStockOeuf.deleteMany({
    where: {
      userId: input.userId,
      type: "vente",
      notes: { startsWith: marqueur },
    },
  })

  let restantAVentiler = quantiteOeufsVendus(input.quantite, input.unite)
  const productions = await tx.productionOeuf.findMany({
    where: {
      userId: input.userId,
      date: { lte: input.date },
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    include: {
      mouvementsStock: { select: { quantite: true } },
    },
  })

  // Ticket cmsoeyhs5 — les pontes sous délai d'attente vétérinaire (soin avec
  // finAttenteOeufs) ne sont pas vendables : même règle que computeStockOeufsParLots.
  const blocagesVeto = await blocagesVetoPontes(tx, input.userId, productions)

  for (const production of productions) {
    if (restantAVentiler === 0) break
    if (blocagesVeto.has(production.id)) continue
    if (statutLotOeufs(production.date, input.date) !== "commercialisable") continue
    const disponible = stockRestantLotOeufs({
      quantite: production.quantite,
      casses: production.casses,
      sales: production.sales,
      sorties: production.mouvementsStock,
    })
    if (disponible <= 0) continue

    const sortie = Math.min(disponible, restantAVentiler)
    await tx.mouvementStockOeuf.create({
      data: {
        userId: input.userId,
        productionId: production.id,
        date: input.date,
        type: "vente",
        quantite: sortie,
        notes: `${marqueur} Sortie automatique depuis Production > Ventes`,
      },
    })
    restantAVentiler -= sortie
  }

  if (restantAVentiler > 0) {
    throw new StockOeufsVenteError(
      `Stock d’œufs commercialisables insuffisant : il manque ${restantAVentiler} œuf(s).`,
      409,
    )
  }
  return quantiteOeufsVendus(input.quantite, input.unite)
}

export async function supprimerStockOeufsVente(
  tx: Prisma.TransactionClient,
  userId: string,
  venteId: number,
): Promise<void> {
  await tx.mouvementStockOeuf.deleteMany({
    where: {
      userId,
      type: "vente",
      notes: { startsWith: marqueurVenteOeufs(venteId) },
    },
  })
}
