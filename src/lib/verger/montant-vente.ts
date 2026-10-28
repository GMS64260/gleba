/** Même montant effectif pour le miroir, les listes, les marges, la TVA et le FEC. */
export function montantVenteFruit(lot: { prixTotal?: number | null; prixKg?: number | null; quantite: number }) {
  const montant = lot.prixTotal ?? lot.quantite * (lot.prixKg ?? 0)
  return Number.isFinite(montant) && montant >= 0 ? Math.round(montant * 100) / 100 : 0
}

export function periodeVenteVerger(debut: Date, fin: Date) {
  const periode = { gte: debut, lte: fin }
  return { OR: [{ dateVente: periode }, { dateVente: null, date: periode }] }
}
