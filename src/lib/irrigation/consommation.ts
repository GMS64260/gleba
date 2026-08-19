/**
 * Consommation d'eau hebdomadaire d'un ensemble de cultures.
 *
 * QA cmsqlstoi : l'écran Irrigation affichait deux totaux incompatibles sous la
 * même étiquette « L/sem » — le KPI dédoublonnait par planche (une planche
 * multiculture est arrosée en un seul passage, c'est le besoin le plus exigeant
 * qui la pilote) tandis que le total de chaque îlot faisait une somme brute des
 * cultures. Écart mesuré : 9 788 L contre 14 388 L, soit les six planches
 * portant plusieurs cultures.
 *
 * La règle vit donc ici, dans un module pur importable des deux côtés — le
 * serveur (`irrigation-conseil.ts`, qui dépend de Prisma) comme l'écran.
 */

export interface CultureConsommation {
  id: number
  plancheId: string | null
  consommationEauSemaine: number
}

/**
 * Litres par semaine pour un ensemble de cultures, dédoublonnés par planche.
 * Une culture hors planche compte pour elle-même.
 */
export function consommationHebdoTotale(cultures: CultureConsommation[]): number {
  const parPlanche = new Map<string, number>()
  for (const culture of cultures) {
    const cle = culture.plancheId ?? `culture:${culture.id}`
    parPlanche.set(cle, Math.max(parPlanche.get(cle) ?? 0, culture.consommationEauSemaine))
  }
  let total = 0
  for (const litres of parPlanche.values()) total += litres
  return Math.round(total)
}
