type EntiteIdentifiable = { id: string | number }

export type EmpreinteEntite<T> = (entite: T) => string

/**
 * Mémorise uniquement les champs effectivement persistés par le plan.
 * Les objets complets contiennent aussi des données d'affichage (cultures,
 * libellés calculés…) qui ne doivent pas provoquer une écriture.
 */
export function indexerEtatSauve<T extends EntiteIdentifiable>(
  entites: readonly T[],
  empreinte: EmpreinteEntite<T>
): Map<string | number, string> {
  return new Map(entites.map((entite) => [entite.id, empreinte(entite)]))
}

/** Retourne les seules entités nouvelles ou différentes du dernier état sauvé. */
export function entitesModifiees<T extends EntiteIdentifiable>(
  entites: readonly T[],
  etatSauve: ReadonlyMap<string | number, string>,
  empreinte: EmpreinteEntite<T>
): T[] {
  return entites.filter((entite) => etatSauve.get(entite.id) !== empreinte(entite))
}

/**
 * Avance la référence après succès, pour les seules entités envoyées.
 * Une modification locale survenue pendant la requête reste ainsi détectable.
 */
export function confirmerEtatSauve<T extends EntiteIdentifiable>(
  etatSauve: Map<string | number, string>,
  entites: readonly T[],
  empreinte: EmpreinteEntite<T>
): void {
  entites.forEach((entite) => etatSauve.set(entite.id, empreinte(entite)))
}
