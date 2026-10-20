/**
 * Copie d'un objet sans les clés indiquées — l'équivalent typé de
 * `const { a: _, ...reste } = objet`, que la règle `no-unused-vars` du dépôt
 * refuse (pas de motif d'exception pour `_`). Mêmes propriétés propres et
 * énumérables qu'une déstructuration `...reste`, dans le même ordre.
 */
export function sansChamps<T extends object, K extends keyof T>(objet: T, ...cles: K[]): Omit<T, K> {
  const copie = { ...objet } as Record<PropertyKey, unknown>
  for (const cle of cles) delete copie[cle]
  return copie as Omit<T, K>
}
