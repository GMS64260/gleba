/**
 * « Voir les opérations » depuis la fiche d'un arbre (QA cmvnorxov,
 * 2026-10-25) : le lien menait à `/verger?tab=operations` sans rien dire de
 * l'arbre, et l'onglet listait les opérations de tout le verger.
 *
 * Le lien porte l'IDENTIFIANT de l'arbre, jamais son nom. Côté verger, c'est
 * un paramètre d'ouverture : l'onglet Opérations le lit au montage, filtre sur
 * cet arbre en l'affichant, puis le retire de l'URL en gardant le reste de la
 * requête (motif 7 : l'URL n'est pas la source de vérité de l'écran).
 *
 * Le lien porte aussi l'année : la fiche renvoie vers les opérations
 * d'aujourd'hui, alors que sans `?annee=` le verger restaure l'année mémorisée
 * (« en 2025 » sous la puce de l'arbre, revue du 2026-10-25). `?annee=` prime
 * sur la préférence (`useAnneeModule`) et reste dans l'URL après nettoyage.
 */

export const PARAM_ARBRE_OPERATIONS = "arbreId"

/**
 * Lien vers les opérations d'un arbre pour une année :
 * `/verger?tab=operations&arbreId=881&annee=2026`.
 */
export function lienOperationsArbre(arbreId: number, annee: number): string {
  const params = new URLSearchParams({
    tab: "operations",
    [PARAM_ARBRE_OPERATIONS]: String(arbreId),
    annee: String(annee),
  })
  return `/verger?${params.toString()}`
}

/**
 * Lit le paramètre d'ouverture d'une requête (`window.location.search`).
 * - `arbreId` : l'identifiant demandé, ou null s'il est absent ou invalide ;
 * - `requete` : la requête sans ce paramètre (onglet, année… gardés), ou null
 *   quand l'URL n'a rien à nettoyer.
 */
export function lireArbreOuverture(search: string): { arbreId: number | null; requete: string | null } {
  const params = new URLSearchParams(search)
  if (!params.has(PARAM_ARBRE_OPERATIONS)) return { arbreId: null, requete: null }
  const brut = (params.get(PARAM_ARBRE_OPERATIONS) ?? "").trim()
  params.delete(PARAM_ARBRE_OPERATIONS)
  const id = /^\d+$/.test(brut) ? Number(brut) : Number.NaN
  return {
    arbreId: Number.isSafeInteger(id) && id > 0 ? id : null,
    requete: params.toString(),
  }
}

/** Opérations d'un seul arbre, comparées par identifiant ; toutes sans filtre. */
export function operationsDeLArbre<T extends { arbreId: number }>(operations: T[], arbreId: number | null): T[] {
  return arbreId === null ? operations : operations.filter((op) => op.arbreId === arbreId)
}
