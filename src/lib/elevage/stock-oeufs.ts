export type StatutLotOeufs = "commercialisable" | "a_consumer" | "perime"

const ajouterJours = (date: Date, jours: number) => {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + jours)
  return result
}

export function datesLotOeufs(datePonte: Date): {
  limiteVente: Date
  dcr: Date
} {
  return {
    limiteVente: ajouterJours(datePonte, 21),
    dcr: ajouterJours(datePonte, 28),
  }
}

export function statutLotOeufs(
  datePonte: Date,
  maintenant = new Date(),
): StatutLotOeufs {
  const { limiteVente, dcr } = datesLotOeufs(datePonte)
  if (maintenant.getTime() > dcr.getTime()) return "perime"
  if (maintenant.getTime() > limiteVente.getTime()) return "a_consumer"
  return "commercialisable"
}

export function stockRestantLotOeufs(input: {
  quantite: number
  casses?: number | null
  sales?: number | null
  sorties?: readonly { quantite: number }[]
}): number {
  const sorties = input.sorties?.reduce((sum, item) => sum + item.quantite, 0) ?? 0
  return Math.max(0, input.quantite - (input.casses ?? 0) - (input.sales ?? 0) - sorties)
}
