/**
 * Lecture d'un champ « semaine » ou « durée en semaines ».
 *
 * Trois cas à ne pas confondre : champ vide (la valeur est retirée), saisie
 * valide, saisie invalide. Rendre `null` pour une saisie hors plage la
 * confondait avec un effacement voulu : taper 53 vidait le champ et
 * l'enregistrement effaçait la semaine en base (équipe debug, D142).
 */
export type SaisieEntiere =
  | { valeur: number | null; erreur: null }
  | { valeur: null; erreur: string }

export function lireSaisieEntiere(saisie: string, min: number, max: number): SaisieEntiere {
  const texte = saisie.trim()
  if (texte === '') return { valeur: null, erreur: null }
  if (!/^\d+$/.test(texte)) return { valeur: null, erreur: `Nombre entier de ${min} à ${max}` }
  const n = Number(texte)
  if (n < min || n > max) return { valeur: null, erreur: `De ${min} à ${max}` }
  return { valeur: n, erreur: null }
}

/** Texte affiché dans le champ pour une valeur de la base. */
export function saisieDepuisValeur(valeur: number | null | undefined): string {
  return valeur === null || valeur === undefined ? '' : String(valeur)
}
