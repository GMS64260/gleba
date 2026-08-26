/**
 * Choix de la parcelle affichée par le plan quand l'URL porte un usage
 * (`/jardin?usage=culture`, lien de l'accueil maraîchage).
 *
 * Extrait de `app/jardin/page.tsx` le 2026-08-26 pour être testable : la règle
 * y avait été rustinée deux fois sur des retours utilisateurs, et le dernier
 * défaut venait précisément du cas qu'aucun test ne couvrait.
 *
 * Ce que le plan doit garantir : ne jamais afficher un canevas vide alors que
 * le compte possède du contenu. `GET /api/jardin?parcelle=<id>` filtre
 * strictement sur `parcelleGeoId` ; retenir une parcelle sans contenu revient
 * donc à cacher tout le reste, planches non rattachées comprises.
 */

export interface ParcelleCandidate {
  id: string
  usage: string | null
  plancheCount: number
  arbreCount: number
}

/** Une parcelle peut porter plusieurs usages, séparés par des virgules. */
export function parcellePorteUsage(parcelle: ParcelleCandidate, usage: string): boolean {
  return Boolean(
    parcelle.usage
      ?.split(",")
      .map((u) => u.trim())
      .includes(usage),
  )
}

/**
 * Ce qui « habite » une parcelle dépend de l'usage : des planches pour la
 * culture, des arbres pour le verger. Compter les planches d'un verger le
 * déclarerait vide à tort.
 */
export function parcelleHabitee(parcelle: ParcelleCandidate, usage: string): boolean {
  return usage === "verger" ? parcelle.arbreCount > 0 : parcelle.plancheCount > 0
}

/**
 * Rend l'id de la parcelle à sélectionner, ou `null` pour « toutes les
 * parcelles ».
 *
 * - plusieurs parcelles de cet usage → tout montrer (sinon on cache
 *   l'inventaire des autres : retour testeur du 2026-05-26) ;
 * - une seule ET habitée → elle ;
 * - une seule mais vide → tout montrer (défaut du 2026-08-26 : le plan
 *   s'ouvrait vide chez un compte qui possédait trois planches non
 *   rattachées) ;
 * - aucune → tout montrer.
 */
export function parcelleAutoSelectionnee(
  parcelles: ParcelleCandidate[],
  usage: string,
): string | null {
  const candidates = parcelles.filter((p) => parcellePorteUsage(p, usage))
  if (candidates.length !== 1) return null
  const seule = candidates[0]
  return parcelleHabitee(seule, usage) ? seule.id : null
}
