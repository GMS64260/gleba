/**
 * Quantités de récolte VENTILÉES PAR UNITÉ.
 *
 * Depuis que le rendement peut s'exprimer en tiges, pièces ou bottes
 * (cf. `projection.ts`), un total de récolte n'est plus un nombre : c'est une
 * ventilation. Deux réflexes à interdire, et c'est le rôle de ce module.
 *
 * 1. Additionner des unités différentes. 12 kg de carottes plus 360 tiges de
 *    dahlia ne font pas 372 de quoi que ce soit.
 * 2. Ne garder que les kilos, ce qui fait disparaître silencieusement toute la
 *    production d'un maraîcher-fleuriste : c'était l'état livré le 2026-08-20,
 *    honnête mais muet — les écrans annonçaient « 0 kg attendu » à un compte
 *    dont le plan comptait treize semaines de récolte.
 *
 * Une ventilation vide vaut zéro et s'affiche `0 kg` : un compte sans récolte
 * lit une unité familière plutôt qu'un tiret.
 */

import { libelleUniteQuantite, type UniteQuantite } from './projection'

/** Quantités cumulées, une entrée par unité rencontrée. */
export type QuantiteParUnite = Partial<Record<UniteQuantite, number>>

/** Ordre d'affichage stable : les kilos d'abord, le reste dans l'ordre du type. */
const ORDRE_UNITES: readonly UniteQuantite[] = ['kg', 'tige', 'piece', 'botte']

/**
 * Ajoute une quantité à la ventilation, EN PLACE.
 *
 * Muter est ici le comportement voulu : ces accumulateurs sont remplis dans des
 * boucles sur plusieurs milliers de lignes (récoltes, cultures, périodes), et
 * recréer un objet à chaque tour n'apporterait rien qu'une pression mémoire.
 */
export function ajouterQuantite(
  acc: QuantiteParUnite,
  unite: UniteQuantite,
  quantite: number,
): QuantiteParUnite {
  if (!Number.isFinite(quantite) || quantite === 0) return acc
  acc[unite] = (acc[unite] ?? 0) + quantite
  return acc
}

/** Somme de plusieurs ventilations, sans toucher aux sources. */
export function fusionnerQuantites(
  ...ventilations: Array<QuantiteParUnite | null | undefined>
): QuantiteParUnite {
  const total: QuantiteParUnite = {}
  for (const ventilation of ventilations) {
    if (!ventilation) continue
    for (const unite of ORDRE_UNITES) {
      const valeur = ventilation[unite]
      if (valeur != null) ajouterQuantite(total, unite, valeur)
    }
  }
  return total
}

/**
 * Décimales d'une unité. Un kilo se pèse au dixième, une tige se compte : « 359,4
 * tiges » n'est pas une précision, c'est une erreur de lecture.
 */
function decimales(unite: UniteQuantite): number {
  return unite === 'kg' ? 2 : 0
}

/** Arrondi métier, unité par unité. */
export function arrondirQuantites(acc: QuantiteParUnite): QuantiteParUnite {
  const arrondi: QuantiteParUnite = {}
  for (const unite of ORDRE_UNITES) {
    const valeur = acc[unite]
    if (valeur == null) continue
    const facteur = 10 ** decimales(unite)
    arrondi[unite] = Math.round(valeur * facteur) / facteur
  }
  return arrondi
}

/** Entrées non nulles, dans l'ordre d'affichage. */
export function quantitesNonNulles(
  acc: QuantiteParUnite,
): Array<{ unite: UniteQuantite; quantite: number }> {
  const entrees: Array<{ unite: UniteQuantite; quantite: number }> = []
  for (const unite of ORDRE_UNITES) {
    const valeur = acc[unite]
    if (valeur != null && Math.abs(valeur) >= 10 ** -decimales(unite) / 2) {
      entrees.push({ unite, quantite: valeur })
    }
  }
  return entrees
}

/** Une quantité et son unité, accordées et formatées en français. */
export function formatQuantite(quantite: number, unite: UniteQuantite): string {
  const nombre = quantite.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales(unite),
  })
  return `${nombre} ${libelleUniteQuantite(unite, quantite)}`
}

/**
 * Ventilation lisible : « 12,5 kg + 360 tiges ».
 *
 * Le séparateur est un `+` et non une virgule : il dit que les termes ne se
 * confondent pas. Une ventilation vide rend « 0 kg ».
 */
export function formatQuantiteParUnite(acc: QuantiteParUnite): string {
  const entrees = quantitesNonNulles(arrondirQuantites(acc))
  if (entrees.length === 0) return formatQuantite(0, 'kg')
  return entrees.map(({ unite, quantite }) => formatQuantite(quantite, unite)).join(' + ')
}

/**
 * Part en kilos d'une ventilation.
 *
 * Réservée aux calculs qui n'ont de sens qu'en poids (valorisation au kilo,
 * comparaison à un tonnage). Ne JAMAIS l'utiliser pour afficher un total :
 * c'est exactement le geste qui faisait disparaître les tiges.
 */
export function partKg(acc: QuantiteParUnite): number {
  return acc.kg ?? 0
}

/** La ventilation contient-elle autre chose que des kilos ? */
export function contientHorsKg(acc: QuantiteParUnite): boolean {
  return quantitesNonNulles(acc).some(({ unite }) => unite !== 'kg')
}
