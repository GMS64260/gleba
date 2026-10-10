import { libelleEspeceVariete } from "@/lib/cultures/label"

export type IrrigationUrgence = "critique" | "haute" | "moyenne" | "faible" | "aucune"

const ORDRE_URGENCE: Record<IrrigationUrgence, number> = {
  critique: 0,
  haute: 1,
  moyenne: 2,
  faible: 3,
  aucune: 4,
}

export interface RecommandationCulturePlanche {
  cultureId: number
  cultureName: string
  plancheId: string
  plancheName: string
  urgence: IrrigationUrgence
  conseilQuantite: number
  conseilMessage: string
  joursDepuisIrrigation: number | null
  varietyName: string | null
  etatCulture: string
  derniereIrrigation: string | null
}

export type RecommandationPlanche<T extends RecommandationCulturePlanche> = T & {
  cultureIds: number[]
  cultureCount: number
  cultures: Array<{
    id: number
    nom: string
    variete: string | null
    etat: string
  }>
}

/**
 * Une irrigation est une action physique au niveau de la planche.
 * Sur une planche multiculture, la recommandation la plus exigeante pilote
 * l'alerte et les autres cultures restent visibles comme contexte.
 */
export function grouperRecommandationsParPlanche<T extends RecommandationCulturePlanche>(
  recommandations: T[]
): RecommandationPlanche<T>[] {
  const groupes = new Map<string, T[]>()

  for (const recommandation of recommandations) {
    const groupe = groupes.get(recommandation.plancheId) ?? []
    groupe.push(recommandation)
    groupes.set(recommandation.plancheId, groupe)
  }

  return Array.from(groupes.values()).map((groupe) => {
    const pilote = [...groupe].sort((a, b) => {
      const urgence = ORDRE_URGENCE[a.urgence] - ORDRE_URGENCE[b.urgence]
      return urgence !== 0 ? urgence : b.conseilQuantite - a.conseilQuantite
    })[0]

    const cultures = groupe.map((item) => ({
      id: item.cultureId,
      nom: item.cultureName,
      variete: item.varietyName,
      etat: item.etatCulture,
    }))
    const libelles = Array.from(new Set(cultures.map((culture) =>
      libelleEspeceVariete(culture.nom, culture.variete)
    )))
    const cultureName = libelles.length <= 2
      ? libelles.join(" + ")
      : `${libelles.slice(0, 2).join(" + ")} + ${libelles.length - 2}`
    const arrosageSynchronise = groupe.every(
      (item) => item.derniereIrrigation === groupe[0].derniereIrrigation
    )
    const tousArrosesAujourdhui = groupe.every(
      (item) => item.joursDepuisIrrigation === 0
    )

    return {
      ...pilote,
      cultureName,
      varietyName: groupe.length === 1 ? pilote.varietyName : null,
      etatCulture: groupe.length === 1
        ? pilote.etatCulture
        : `${groupe.length} cultures actives`,
      derniereIrrigation: arrosageSynchronise ? pilote.derniereIrrigation : null,
      joursDepuisIrrigation: tousArrosesAujourdhui
        ? 0
        : pilote.joursDepuisIrrigation,
      conseilMessage: groupe.length === 1
        ? pilote.conseilMessage
        : `Planche multiculture : le besoin le plus exigeant (${pilote.cultureName}) pilote ce conseil. ${pilote.conseilMessage}`,
      cultureIds: cultures.map((culture) => culture.id),
      cultureCount: cultures.length,
      cultures,
    }
  })
}
