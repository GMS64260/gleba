/**
 * Nommage des duplications sur le plan du jardin.
 *
 * Friction observée le 2026-07-30 : la duplication suffixait « -copie » au nom
 * de la planche source, et la copie devenait la sélection courante. Dupliquer
 * dix fois la même planche produisait donc
 * « 4-copie-copie-copie-copie-copie-copie-copie », illisible et impossible à
 * remettre d'aplomb sans dix renommages manuels.
 *
 * On repart désormais du nom *de base* (suffixes de copie retirés) et on
 * numérote : « 4 (2) », « 4 (3) »… Les anciens noms hérités sont reconnus, donc
 * dupliquer une « 4-copie-copie » existante redonne « 4 (2) » si le numéro est
 * libre.
 */

/** Suffixes de copie reconnus en fin de nom, hérités ou courants. */
const SUFFIXE_COPIE = /(?:\s*\(\d+\)|\s*\(copie\)|-copie\d*)+$/i

/** Retire les suffixes de copie pour retrouver le nom d'origine. */
export function nomDeBase(nom: string): string {
  return nom.replace(SUFFIXE_COPIE, "").trim() || nom.trim()
}

/**
 * Prochain nom libre pour une copie de `source`.
 *
 * @param source nom de l'élément dupliqué (peut déjà être une copie)
 * @param existants noms déjà pris dans le même plan
 */
export function prochainNomCopie(source: string, existants: Iterable<string>): string {
  const base = nomDeBase(source)
  const pris = new Set<string>()
  for (const nom of existants) pris.add(nom.trim())

  let n = 2
  while (pris.has(`${base} (${n})`)) n++
  return `${base} (${n})`
}

/**
 * Suite de noms libres pour `nombre` copies successives, sans collision entre
 * elles (la duplication en lot n'a pas d'aller-retour serveur intermédiaire).
 */
export function nomsCopiesEnLot(
  source: string,
  existants: Iterable<string>,
  nombre: number
): string[] {
  const pris = new Set<string>()
  for (const nom of existants) pris.add(nom.trim())

  const noms: string[] = []
  for (let i = 0; i < nombre; i++) {
    const nom = prochainNomCopie(source, pris)
    noms.push(nom)
    pris.add(nom)
  }
  return noms
}
