/**
 * Indicateurs économiques du lait & du fromage (PROMPT 22).
 *
 * Fonctions pures : reçoivent des agrégats déjà calculés (litres, CA, coûts) et
 * en dérivent les indicateurs de pilotage d'une exploitation laitière :
 * marge sur coût alimentaire (MCA), coût de revient du litre, prix moyen du
 * litre valorisé, rendement fromager et coût de revient du kg de fromage.
 *
 * L'affectation des coûts au lait (part du troupeau, prorata) est faite en
 * amont dans la route ; ici on ne fait que combiner des nombres.
 */

export type IntrantsEconomieLait = {
  /** Litres produits (collectés) sur la période. */
  litresProduits: number
  /** Litres transformés en fromage (volume affecté aux lots). */
  litresTransformes: number
  /** Litres vendus en lait cru. */
  litresVendusCru: number
  /** Litres écartés (temps d'attente vétérinaire). */
  litresEcartes: number
  /** CA des ventes de lait cru (€). */
  caLaitCru: number
  /** CA des ventes de fromage (€). */
  caFromage: number
  /** Coût alimentaire affecté au troupeau laitier (€). */
  coutAlimentaire: number
  /** Coût sanitaire (soins) affecté au troupeau laitier (€). */
  coutSanitaire: number
  /** Kg de fromage fabriqués sur la période. */
  kgFromage: number
}

export type IndicateursEconomieLait = {
  valorisation: number
  coutTotal: number
  marge: number
  /** Marge sur coût alimentaire (€) = valorisation − coût alimentaire. */
  mca: number
  /** MCA ramenée à 1000 L de lait produit (€/1000 L). */
  mcaPour1000L: number | null
  /** Coût alimentaire par litre produit (€/L). */
  coutAlimentaireLitre: number | null
  /** Coût de revient par litre produit (alim + sanitaire) (€/L). */
  coutRevientLitre: number | null
  /** Prix moyen du litre valorisé (€/L) = valorisation / litres produits. */
  prixMoyenLitreValorise: number | null
  /** Rendement fromager global (kg fromage / L lait transformé). */
  rendementFromager: number | null
  /** Litres de lait pour 1 kg de fromage (inverse du rendement). */
  litresParKgFromage: number | null
  /** Coût de revient du kg de fromage (€/kg), coûts alloués au prorata des litres transformés. */
  coutRevientKgFromage: number | null
}

const r2 = (v: number) => Math.round(v * 100) / 100
const r3 = (v: number) => Math.round(v * 1000) / 1000

export function indicateursEconomieLait(x: IntrantsEconomieLait): IndicateursEconomieLait {
  const valorisation = x.caLaitCru + x.caFromage
  const coutTotal = x.coutAlimentaire + x.coutSanitaire
  const litres = x.litresProduits

  const mca = valorisation - x.coutAlimentaire
  const marge = valorisation - coutTotal

  // Part des coûts imputable à la transformation (prorata des litres transformés)
  const partTransfo = litres > 0 ? Math.min(1, x.litresTransformes / litres) : 0
  const coutRevientKgFromage =
    x.kgFromage > 0 ? r2((coutTotal * partTransfo) / x.kgFromage) : null

  return {
    valorisation: r2(valorisation),
    coutTotal: r2(coutTotal),
    marge: r2(marge),
    mca: r2(mca),
    mcaPour1000L: litres > 0 ? r2((mca / litres) * 1000) : null,
    coutAlimentaireLitre: litres > 0 ? r3(x.coutAlimentaire / litres) : null,
    coutRevientLitre: litres > 0 ? r3(coutTotal / litres) : null,
    prixMoyenLitreValorise: litres > 0 ? r3(valorisation / litres) : null,
    rendementFromager: x.litresTransformes > 0 ? r3(x.kgFromage / x.litresTransformes) : null,
    litresParKgFromage: x.kgFromage > 0 ? r2(x.litresTransformes / x.kgFromage) : null,
    coutRevientKgFromage,
  }
}
