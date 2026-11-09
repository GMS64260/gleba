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

/** Champs d'une collecte qui pèsent sur son stock ou sa traçabilité. */
export interface EtatCollecteOeufs {
  quantite: number
  casses?: number | null
  sales?: number | null
  date: Date
  lotId: number | null
  animalId: number | null
}

/**
 * Peut-on corriger une collecte dont des œufs sont déjà sortis (vente, don,
 * autoconsommation…) ? Oui tant que la correction ne contredit pas ces sorties :
 * les notes et le calibre se changent librement, la quantité nette ne descend
 * pas sous le total sorti, le jour ne passe pas après la première sortie, et le
 * lot (traçabilité des œufs déjà partis) ne change pas.
 *
 * Avant, toute modification était refusée dès la première sortie, avec un
 * message qui demandait de « supprimer les mouvements » alors que ceux d'une
 * vente ne se suppriment pas : une faute de frappe (300 pour 30) ne se
 * corrigeait plus qu'en annulant chaque vente.
 *
 * Rend le motif du refus, ou `null` si la correction est admise.
 */
export function refusModificationCollecteEntamee(
  avant: EtatCollecteOeufs,
  apres: EtatCollecteOeufs,
  sorties: readonly { quantite: number; date: Date }[],
  finJourSortie: (date: Date) => Date = (date) => date,
): string | null {
  if (sorties.length === 0) return null
  const sortis = sorties.reduce((total, sortie) => total + sortie.quantite, 0)
  const net = apres.quantite - (apres.casses ?? 0) - (apres.sales ?? 0)
  if (net < sortis) {
    return `${sortis} œuf${sortis > 1 ? 's' : ''} de cette collecte ${sortis > 1 ? 'sont déjà sortis' : 'est déjà sorti'} du stock (ventes, dons, autoconsommation) : la quantité nette ne peut pas descendre sous ${sortis}. Annulez d'abord les ventes concernées dans Élevage > Ventes.`
  }
  if (apres.date.getTime() !== avant.date.getTime()) {
    const premiere = sorties.reduce((min, sortie) => (sortie.date < min ? sortie.date : min), sorties[0].date)
    if (apres.date.getTime() > finJourSortie(premiere).getTime()) {
      return 'Des œufs de cette collecte sont sortis du stock avant cette date : la collecte ne peut pas être postérieure à sa première sortie.'
    }
  }
  if (apres.lotId !== avant.lotId || apres.animalId !== avant.animalId) {
    return "Des œufs de cette collecte sont déjà sortis du stock : son lot ne peut plus changer (traçabilité). Annulez d'abord les ventes concernées."
  }
  return null
}
