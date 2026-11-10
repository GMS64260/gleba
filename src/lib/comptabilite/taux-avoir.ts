/**
 * Taux de TVA d'un avoir : ceux de la facture qu'il annule.
 * Rend le taux de la première ligne étrangère à la facture d'origine, ou `null`
 * si l'avoir est cohérent (ou si la facture d'origine n'a pas de ligne lue).
 */
export function tauxEtrangerALaFacture(
  tauxFactureOrigine: readonly number[],
  lignesAvoir: ReadonlyArray<{ tauxTVA: number }>,
): number | null {
  if (tauxFactureOrigine.length === 0) return null
  const etrangere = lignesAvoir.find((l) => !tauxFactureOrigine.some((t) => Math.abs(t - l.tauxTVA) < 0.001))
  return etrangere ? etrangere.tauxTVA : null
}
