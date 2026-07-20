export interface DashboardProduction {
  type: "oeufs" | "lait" | "fromage" | "viande"
  label: string
  quantite: number
  unite: "œufs" | "L" | "pièces" | "kg"
  detail?: string
}

export interface DashboardVentes {
  categories: { categorie: string; label: string }[]
  mois: Array<{ mois: number; label: string; [categorie: string]: number | string }>
}

interface VenteDashboard {
  type: string
  date: Date
  prixTotal: number
}

interface VenteDashboardClient {
  venteProduit: {
    findMany: (args: {
      where: { userId: string; annule: false; date: { gte: Date; lte: Date } }
      select: { type: true; date: true; prixTotal: true }
      orderBy: { date: "asc" }
    }) => Promise<VenteDashboard[]>
  }
}

interface DashboardProductionTotals {
  oeufs: number
  laitLitres: number
  fromagePieces: number
  fromageKg: number
  viandeKg: number
}

export function aUneActiviteOeufsDashboard({
  animauxPondeursActifs,
  lotsPondeursActifs,
  oeufsProduitsAnnee,
}: {
  animauxPondeursActifs: number
  lotsPondeursActifs: number
  oeufsProduitsAnnee: number
}) {
  return animauxPondeursActifs > 0 || lotsPondeursActifs > 0 || oeufsProduitsAnnee > 0
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

const VENTES_LABELS: Record<string, string> = {
  oeufs: "Œufs",
  lait: "Lait",
  fromage: "Fromage",
  autre: "Autres",
  animal_vivant: "Animal vivant",
}

const labelVente = (type: string) =>
  VENTES_LABELS[type] ?? type.replaceAll("_", " ").replace(/^./u, (lettre) => lettre.toLocaleUpperCase("fr-FR"))

const LIBELLES_MOIS = ["Jan.", "Fév.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."]

/** Agrège les ventes par mois et catégorie sans figer les catégories disponibles. */
export function construireVentesDashboard(ventes: VenteDashboard[]): DashboardVentes {
  const categories = new Set<string>()
  const mois: DashboardVentes["mois"] = LIBELLES_MOIS.map((label, index) => ({ mois: index + 1, label }))

  for (const vente of ventes) {
    const categorie = vente.type.toLocaleLowerCase("fr-FR")
    const indexMois = vente.date.getMonth()
    if (indexMois < 0 || indexMois > 11) continue
    categories.add(categorie)
    const courant = Number(mois[indexMois][categorie] ?? 0)
    mois[indexMois][categorie] = arrondir(courant + Number(vente.prixTotal ?? 0))
  }

  return {
    categories: Array.from(categories).map((categorie) => ({ categorie, label: labelVente(categorie) })),
    mois,
  }
}

export async function agregerVentesDashboard(
  client: VenteDashboardClient,
  userId: string,
  startOfYear: Date,
  endOfYear: Date
) {
  const ventes = await client.venteProduit.findMany({
    where: { userId, annule: false, date: { gte: startOfYear, lte: endOfYear } },
    select: { type: true, date: true, prixTotal: true },
    orderBy: { date: "asc" },
  })
  return construireVentesDashboard(ventes)
}

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
