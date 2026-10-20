/**
 * Rendement carcasse d'un profil d'élevage (`EspeceAnimale.rendementCarcasse`).
 *
 * Convention unique (QA cmvgeif10, 2026-10-20) : la base et l'API portent un
 * RATIO du poids vif (0,65), l'écran affiche et saisit un POURCENTAGE (65 %).
 * Le champ « Rendement carc. (%) » refusait 65 et exigeait 0,65.
 *
 * Quatre entrées du catalogue, semées avant cette règle, portent encore un
 * pourcentage (45, 60, 70, 75). Un rendement carcasse ne dépasse jamais le
 * poids vif : une valeur stockée > 1 est donc sans ambiguïté un pourcentage,
 * ramenée en ratio à la lecture (pas de migration).
 *
 * Plancher 1 % (revue du 2026-10-20) : l'ancien champ exigeait un ratio
 * (« 0.72 ») ; tapée par habitude dans le champ en %, « 0,65 » serait
 * enregistrée 0,65 % (ratio 0,0065). Aucun rendement réel n'est sous 1 % du
 * poids vif : l'écran et la route refusent en nommant l'unité.
 */

/** Plancher du rendement carcasse : 1 % du poids vif. */
export const RENDEMENT_CARCASSE_RATIO_MIN = 0.01

export const RENDEMENT_CARCASSE_ERREUR_API =
  'Rendement carcasse (rendementCarcasse) : ratio du poids vif entre 0,01 et 1, soit 1 à 100 % (ex. 0,72 pour 72 %).'

export const RENDEMENT_CARCASSE_ERREUR_SAISIE =
  'Rendement carcasse : pourcentage entre 1 et 100 du poids vif, ex. 72 (et non 0,72).'

const arrondi = (valeur: number, decimales: number) => {
  const facteur = 10 ** decimales
  return Math.round(valeur * facteur) / facteur
}

/** Valeur stockée → ratio (une ancienne valeur en pourcentage est ramenée). */
export function rendementCarcasseEnRatio(stocke: number | null | undefined): number | null {
  if (stocke == null || !Number.isFinite(stocke)) return null
  return stocke > 1 ? arrondi(stocke / 100, 4) : stocke
}

/** Valeur stockée → texte du champ de saisie en pourcentage (0,72 → « 72 »). */
export function rendementCarcassePourSaisie(stocke: number | null | undefined): string {
  const ratio = rendementCarcasseEnRatio(stocke)
  // Un rendement nul ou négatif n'a pas de sens : champ vide plutôt qu'un
  // formulaire bloqué par une valeur que l'éleveur n'a pas saisie.
  return ratio == null || ratio <= 0 ? '' : String(arrondi(ratio * 100, 2))
}

/**
 * Saisie de l'écran en pourcentage → ratio envoyé à l'API.
 * Vide → null ; hors [1, 100] ou illisible → erreur nommant le champ et l'unité.
 */
export function rendementCarcasseDepuisSaisie(
  saisie: string,
): { ok: true; ratio: number | null } | { ok: false; erreur: string } {
  const brut = saisie.trim().replace(',', '.')
  if (brut === '') return { ok: true, ratio: null }
  const pourcentage = Number(brut)
  if (!Number.isFinite(pourcentage) || pourcentage < RENDEMENT_CARCASSE_RATIO_MIN * 100 || pourcentage > 100) {
    return { ok: false, erreur: RENDEMENT_CARCASSE_ERREUR_SAISIE }
  }
  return { ok: true, ratio: arrondi(pourcentage / 100, 4) }
}

/**
 * Règle de la route (POST et PUT des profils d'élevage) : absent → inchangé,
 * null → effacé, sinon un ratio dans [0,01 ; 1].
 */
export function validerRendementCarcasseApi(
  valeur: unknown,
): { ok: true; ratio: number | null | undefined } | { ok: false; erreur: string } {
  if (valeur === undefined) return { ok: true, ratio: undefined }
  if (valeur === null) return { ok: true, ratio: null }
  if (
    typeof valeur !== 'number' ||
    !Number.isFinite(valeur) ||
    valeur < RENDEMENT_CARCASSE_RATIO_MIN ||
    valeur > 1
  ) {
    return { ok: false, erreur: RENDEMENT_CARCASSE_ERREUR_API }
  }
  return { ok: true, ratio: valeur }
}
