/**
 * Lecture bornée des paramètres de liste (`page`, `pageSize`, `sortBy`,
 * `sortOrder`) des routes GET du maraîchage.
 *
 * Revue du 2026-11-11 — ces paramètres allaient tels quels à Prisma :
 * `pageSize=abc` (NaN), `page=0` (skip négatif) ou un `sortBy` qui n'est pas une
 * colonne rendaient une erreur 500. Une valeur inexploitable retombe ici sur le
 * défaut de la liste, sans refuser la requête : ces paramètres ne portent que
 * de la présentation.
 */

/** Plafond d'une page : celui déjà appliqué aux récoltes. */
export const TAILLE_PAGE_MAX = 5000

export interface OptionsListe<Tri extends string> {
  taillePageDefaut: number
  /** Colonnes sur lesquelles la liste peut être triée. */
  trisPermis: readonly Tri[]
  triDefaut: Tri
  ordreDefaut: 'asc' | 'desc'
}

export interface ParametresListe<Tri extends string> {
  page: number
  pageSize: number
  skip: number
  sortBy: Tri
  sortOrder: 'asc' | 'desc'
}

/** Entier strictement positif écrit en chiffres, sinon `null`. */
function entierPositif(valeur: string | null): number | null {
  if (valeur == null || !/^\d+$/.test(valeur.trim())) return null
  const nombre = Number(valeur)
  return Number.isSafeInteger(nombre) && nombre >= 1 ? nombre : null
}

export function lireParametresListe<Tri extends string>(
  searchParams: URLSearchParams,
  options: OptionsListe<Tri>
): ParametresListe<Tri> {
  const page = entierPositif(searchParams.get('page')) ?? 1
  const pageSize = Math.min(
    TAILLE_PAGE_MAX,
    entierPositif(searchParams.get('pageSize')) ?? options.taillePageDefaut
  )
  const tri = searchParams.get('sortBy')
  const sortBy = options.trisPermis.find((permis) => permis === tri) ?? options.triDefaut
  const ordre = searchParams.get('sortOrder')
  const sortOrder = ordre === 'asc' || ordre === 'desc' ? ordre : options.ordreDefaut
  return { page, pageSize, skip: (page - 1) * pageSize, sortBy, sortOrder }
}

/** Année passée en filtre : un entier plausible, sinon `null` (filtre ignoré). */
export function lireAnneeFiltre(valeur: string | null): number | null {
  const annee = entierPositif(valeur)
  return annee != null && annee <= 9999 ? annee : null
}
