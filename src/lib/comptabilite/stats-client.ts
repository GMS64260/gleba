/**
 * Lecture de GET /api/comptabilite/stats par les écrans (client).
 *
 * Le dépôt public garde la version de main de cette route (surcharge de la
 * zone privée) : sa réponse n'a ni voisins `…ParDevise` ni totaux `null` en
 * multi-devise, et additionnerait EUR et XPF. Quand `stats.revenusParDevise`
 * manque (ou que le lecteur historique refuse un mélange), l'écran lit la route publique GET /api/comptabilite/stats/devises,
 * même calcul (`stats-exercice.ts`) au contrat devise. Si elle échoue, aucune
 * donnée n'est rendue : jamais une somme de deux devises.
 */
export async function chargerStatsComptables<T>(year: number, fetcher: typeof fetch = fetch): Promise<T | null> {
  const res = await fetcher(`/api/comptabilite/stats?year=${year}`)
  if (res.status === 401 || res.status === 403) return null
  const json = res.ok ? await res.json() : null
  if (json?.stats && Array.isArray(json.stats.revenusParDevise)) return json as T
  const raccord = await fetcher(`/api/comptabilite/stats/devises?year=${year}`)
  if (!raccord.ok) return null
  const complet = await raccord.json()
  return complet?.stats && Array.isArray(complet.stats.revenusParDevise) ? (complet as T) : null
}
