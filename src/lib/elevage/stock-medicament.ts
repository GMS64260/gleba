export interface StockMedicamentDisponible {
  quantite: number
  datePeremption: string | Date | null
}

/**
 * Un lot de pharmacie est sélectionnable s'il reste du stock et s'il n'est
 * pas périmé à la date du soin. La péremption le jour même reste valide,
 * comme dans la validation de l'API des soins.
 */
export function stockMedicamentEstDisponible(
  stock: StockMedicamentDisponible,
  dateSoin: string | Date,
): boolean {
  if (stock.quantite <= 0) return false
  if (!stock.datePeremption) return true

  const peremption = new Date(stock.datePeremption)
  const soin = new Date(dateSoin)
  if (Number.isNaN(peremption.getTime()) || Number.isNaN(soin.getTime())) {
    return false
  }

  return !lotMedicamentPerime(stock.datePeremption, dateSoin)
}

const JOUR_SEUL = /^\d{4}-\d{2}-\d{2}$/
const jourCivilParis = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
})

/** Jour civil (AAAA-MM-JJ) d'un soin : la chaîne « jour seul » telle quelle, sinon le jour à Paris de l'instant. */
export function jourCivilSoin(dateSoin: string | Date): string {
  if (typeof dateSoin === 'string' && JOUR_SEUL.test(dateSoin)) return dateSoin
  return jourCivilParis.format(new Date(dateSoin))
}

/**
 * Un lot est périmé à la date d'un soin si le JOUR du soin est postérieur au
 * jour de péremption. La péremption est un jour seul, stocké à minuit UTC :
 * comparer des instants refusait « Fait » à 10 h le jour même de la péremption
 * (10:00 > 00:00), alors que le formulaire, qui compare des jours, l'acceptait.
 */
export function lotMedicamentPerime(
  datePeremption: string | Date | null | undefined,
  dateSoin: string | Date,
): boolean {
  if (!datePeremption) return false
  const jourPeremption = new Date(datePeremption).toISOString().slice(0, 10)
  return jourCivilSoin(dateSoin) > jourPeremption
}

/** Minuit UTC du jour civil du soin : borne basse d'un filtre SQL `datePeremption >= …`. */
export function debutJourCivilSoin(dateSoin: Date): Date {
  return new Date(`${jourCivilSoin(dateSoin)}T00:00:00.000Z`)
}


/** Note posée par la mise au rebut d'un lot (`PATCH /api/elevage/stock-medicaments`, `rebut`). */
export const MARQUE_REBUT_MEDICAMENT = 'Mis au rebut le '

/**
 * Lot mis au rebut : stock à zéro et note de rebut. Rien ne doit y être remis :
 * supprimer ou rouvrir un de ses soins y réincrémentait les doses, le lot
 * périmé redevenait sélectionnable et sa note « Mis au rebut » devenait fausse.
 */
export function estLotMedicamentAuRebut(stock: { quantite: number; notes?: string | null }): boolean {
  return stock.quantite <= 0 && (stock.notes ?? '').includes(MARQUE_REBUT_MEDICAMENT)
}

/**
 * L'unité d'un prélèvement est celle du lot : « 2 doses » prélevées sur un lot
 * tenu en mL retiraient 2 mL. Rend le motif du refus, ou `null`.
 */
export function refusUnitePrelevement(uniteSoin: string | null | undefined, uniteLot: string): string | null {
  const normaliser = (unite: string) => unite.trim().toLowerCase()
  if (!uniteSoin || normaliser(uniteSoin) === normaliser(uniteLot)) return null
  return `La quantité prélevée s'exprime dans l'unité du lot de pharmacie (${uniteLot}), pas en « ${uniteSoin} ».`
}
