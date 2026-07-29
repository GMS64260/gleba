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

  return peremption.getTime() >= soin.getTime()
}
