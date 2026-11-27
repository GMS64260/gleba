/**
 * Nombres saisis dans un formulaire : une seule façon de les afficher et de
 * les relire.
 *
 * Deux pièges ont motivé ce module (équipe debug, D58 et D72) :
 * - `valeur ? String(valeur) : ""` affiche un 0 comme un champ vide, et
 *   l'enregistrement suivant efface la valeur ;
 * - un champ `type="number"` suit la langue du navigateur, pas celle de la
 *   page : selon le réglage, la virgule de « 2,50 » est avalée et le
 *   formulaire envoie 250.
 */

/** Valeur d'un champ pour un nombre stocké : 0 reste « 0 », seul l'absent est vide. */
export function versChampNombre(valeur: number | null | undefined): string {
  return valeur === null || valeur === undefined || !Number.isFinite(valeur) ? '' : String(valeur)
}

const ESPACES = /[\s  ]/g

/**
 * Lit « 2,50 », « 2.5 », « 1 200,5 » ou « -3 ».
 * Rend `null` pour un champ vide et `NaN` pour une saisie illisible : les deux
 * cas ne se confondent pas, un champ vide n'est pas une erreur.
 */
export function lireNombreSaisi(saisie: string | number | null | undefined): number | null {
  if (saisie === null || saisie === undefined) return null
  if (typeof saisie === 'number') return Number.isFinite(saisie) ? saisie : NaN
  let texte = saisie.replace(ESPACES, '')
  if (texte === '') return null
  // Point ET virgule : le dernier est la décimale, l'autre sépare les
  // milliers (« 1.234,56 », « 1,234.56 »). Jamais deviné avec un seul signe.
  if (texte.includes('.') && texte.includes(',')) {
    const decimale = texte.lastIndexOf('.') > texte.lastIndexOf(',') ? '.' : ','
    const milliers = decimale === '.' ? ',' : '.'
    if (texte.indexOf(decimale) !== texte.lastIndexOf(decimale)) return NaN
    if (!new RegExp(`^-?\\d{1,3}(\\${milliers}\\d{3})+\\${decimale}\\d*$`).test(texte)) return NaN
    texte = texte.split(milliers).join('')
  }
  texte = texte.replace(',', '.')
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(texte)) return NaN
  return Number(texte)
}

/** Vrai si la saisie est vide ou se lit comme un nombre, dans les bornes données. */
export function nombreSaisiValide(
  saisie: string,
  bornes: { min?: number; max?: number; strict?: boolean } = {},
): boolean {
  const n = lireNombreSaisi(saisie)
  if (n === null) return true
  if (Number.isNaN(n)) return false
  if (bornes.min !== undefined && (bornes.strict ? n <= bornes.min : n < bornes.min)) return false
  if (bornes.max !== undefined && n > bornes.max) return false
  return true
}

/**
 * Ce qu'un champ décimal laisse taper : chiffres, espaces, virgules, points,
 * et un signe en tête si `negatif`. Rien n'est retiré en silence parmi les
 * séparateurs : « 1.234,56 » collé reste lisible, et une saisie ambiguë est
 * refusée par `lireNombreSaisi` au lieu d'être déformée.
 */
export function filtrerSaisieDecimale(saisie: string): string {
  let sortie = ''
  for (const c of saisie) {
    if ((c >= '0' && c <= '9') || c === ',' || c === '.') sortie += c
    else if (c === ' ' || c === '\u00a0' || c === '\u202f') sortie += sortie === '' ? '' : ' '
    // Le signe est toujours gardé : retiré en silence, « -2 » s'enregistrait
    // comme 2 (équipe debug, D114). Le formulaire refuse ensuite le négatif.
    else if (c === '-' && sortie === '') sortie += c
  }
  return sortie
}
