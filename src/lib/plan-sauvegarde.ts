/**
 * Règle de sauvegarde du plan 2D face aux confirmations GPS en attente.
 *
 * Déplacer un arbre géolocalisé réécrit son relevé terrain : la nouvelle
 * position n'est donc persistée qu'après confirmation explicite (correctif du
 * 2026-07-26). Le verrou initial portait sur la sauvegarde entière, si bien
 * qu'une confirmation abandonnée sans réponse rendait planches, objets et tous
 * les autres arbres non enregistrables — silencieusement, et sans issue puisque
 * le plan n'a pas de bouton « Enregistrer » manuel (QA 2026-07-30).
 *
 * La règle correcte tient en deux points : ne jamais écrire un arbre dont la
 * confirmation est pendante, et ne jamais laisser cette attente bloquer le
 * reste du plan.
 */

export type ElementPositionne = { id: number }

export type PartitionSauvegardePlan<T extends ElementPositionne> = {
  /** Arbres à écrire immédiatement. */
  aEcrire: T[]
  /** Arbres dont l'écriture attend une confirmation GPS. */
  differes: T[]
}

export function partitionnerArbresPourSauvegarde<T extends ElementPositionne>(
  arbres: readonly T[],
  idsEnAttenteConfirmationGps: Iterable<number>,
): PartitionSauvegardePlan<T> {
  const enAttente = new Set(idsEnAttenteConfirmationGps)
  if (enAttente.size === 0) return { aEcrire: [...arbres], differes: [] }

  const aEcrire: T[] = []
  const differes: T[] = []
  for (const arbre of arbres) {
    if (enAttente.has(arbre.id)) differes.push(arbre)
    else aEcrire.push(arbre)
  }
  return { aEcrire, differes }
}
