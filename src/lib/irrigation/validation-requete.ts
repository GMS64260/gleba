/**
 * Lecture des entrées des routes `/api/irrigations` : un identifiant ou une
 * date illisibles partaient tels quels vers Prisma (NaN, Invalid Date), qui
 * levait, et la route rendait 500 au lieu de 400. Module pur.
 */

/** Plus grand identifiant d'une colonne entière PostgreSQL. */
const ENTIER_MAX = 2_147_483_647

/**
 * Entier strictement positif, lu d'un paramètre d'URL (texte en chiffres) ou
 * d'un corps JSON (nombre) ; null sinon. « 12abc » n'est pas 12.
 */
export function entierPositif(valeur: unknown): number | null {
  const n =
    typeof valeur === 'number' ? valeur : typeof valeur === 'string' && /^\d+$/.test(valeur) ? Number(valeur) : NaN
  return Number.isInteger(n) && n > 0 && n <= ENTIER_MAX ? n : null
}

/** Date lisible (texte ISO ou horodatage) ; null sinon. */
export function dateLisible(valeur: unknown): Date | null {
  if ((typeof valeur !== 'string' || valeur.trim() === '') && typeof valeur !== 'number') return null
  const date = new Date(valeur)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Corps JSON d'une requête s'il s'agit d'un objet ; null sinon (illisible, tableau, texte). */
export async function corpsObjet(request: Request): Promise<Record<string, unknown> | null> {
  const corps: unknown = await request.json().catch(() => null)
  return corps && typeof corps === 'object' && !Array.isArray(corps) ? (corps as Record<string, unknown>) : null
}
