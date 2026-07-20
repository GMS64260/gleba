export interface DashboardProduction {
  type: "oeufs" | "lait" | "fromage" | "viande"
  label: string
  quantite: number
  unite: "œufs" | "L" | "pièces" | "kg"
  detail?: string
}

interface DashboardProductionTotals {
  oeufs: number
  laitLitres: number
  fromagePieces: number
  fromageKg: number
  viandeKg: number
}

interface DashboardProductionAggregateClient {
  collecteLait: {
    aggregate: (args: {
      where: { userId: string; date: { gte: Date; lte: Date } }
      _sum: { quantiteLitres: true }
      _count: true
    }) => Promise<{ _sum: { quantiteLitres: unknown }; _count: number }>
  }
  lotFromage: {
    aggregate: (args: {
      where: { userId: string; dateFabrication: { gte: Date; lte: Date } }
      _sum: { nbPieces: true; poidsTotalKg: true }
    }) => Promise<{ _sum?: { nbPieces?: number | null; poidsTotalKg?: unknown } | null }>
  }
}

export async function agregerProductionsLaitieresDashboard(
  client: DashboardProductionAggregateClient,
  userId: string,
  startOfYear: Date,
  endOfYear: Date
) {
  const periode = { gte: startOfYear, lte: endOfYear }
  const [lait, fromage] = await Promise.all([
    client.collecteLait.aggregate({
      where: { userId, date: periode },
      _sum: { quantiteLitres: true },
      _count: true,
    }),
    client.lotFromage.aggregate({
      where: { userId, dateFabrication: periode },
      _sum: { nbPieces: true, poidsTotalKg: true },
    }),
  ])

  return {
    laitLitres: Number(lait._sum.quantiteLitres ?? 0),
    nbCollectes: lait._count,
    fromagePieces: fromage._sum?.nbPieces ?? 0,
    fromageKg: Number(fromage._sum?.poidsTotalKg ?? 0),
  }
}

const arrondir = (valeur: number, decimales = 2) =>
  Math.round(valeur * 10 ** decimales) / 10 ** decimales

/**
 * Construit la synthèse multi-production du dashboard.
 * Les catégories sans production sont volontairement omises.
 */
export function construireProductionsDashboard(
  totaux: DashboardProductionTotals
): DashboardProduction[] {
  const productions: DashboardProduction[] = []

  if (totaux.oeufs > 0) {
    productions.push({ type: "oeufs", label: "Œufs", quantite: totaux.oeufs, unite: "œufs" })
  }
  if (totaux.laitLitres > 0) {
    productions.push({ type: "lait", label: "Lait collecté", quantite: arrondir(totaux.laitLitres), unite: "L" })
  }
  if (totaux.fromagePieces > 0 || totaux.fromageKg > 0) {
    const fromageKg = arrondir(totaux.fromageKg)
    const fromagePieces = totaux.fromagePieces
    productions.push({
      type: "fromage",
      label: "Fromages fabriqués",
      quantite: fromagePieces > 0 ? fromagePieces : fromageKg,
      unite: fromagePieces > 0 ? "pièces" : "kg",
      detail: fromagePieces > 0 && fromageKg > 0 ? `${fromageKg} kg au total` : undefined,
    })
  }
  if (totaux.viandeKg > 0) {
    productions.push({ type: "viande", label: "Viande (carcasse)", quantite: arrondir(totaux.viandeKg), unite: "kg" })
  }

  return productions
}
