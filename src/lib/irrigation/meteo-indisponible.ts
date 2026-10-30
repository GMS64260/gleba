/**
 * Lecture, par le conseiller d'irrigation (`IrrigationAdvisor`), des cultures
 * que `/api/meteo/irrigation` n'a pas pu calculer faute de météo (revue du
 * 2026-10-28). Une panne ne se lit plus « Aucune culture active » : la
 * réponse garde les cultures, au repli, et dit combien de zones sont muettes.
 * Module pur, importable côté client.
 */

export type CauseSansMeteo = "meteo-indisponible" | "sans-coordonnees"

/**
 * Bandeau du conseiller : la panne totale (`indisponible`) ou le nombre de
 * zones sans météo ; null sinon. Une culture sans parcelle géolocalisée n'en
 * fait pas : sa ligne invite déjà à géolocaliser.
 */
export function bandeauMeteoIndisponible(reponse: {
  indisponible?: boolean
  zonesIndisponibles?: number
  culturesSansMeteo?: number
}): string | null {
  const zones = reponse.zonesIndisponibles ?? 0
  if (reponse.indisponible) {
    return "Météo momentanément indisponible : aucun bilan hydrique calculé. Les cultures restent listées, sans dose ; conseil à revoir plus tard."
  }
  if (zones <= 0) return null
  return zones > 1
    ? `Météo momentanément indisponible pour ${zones} zones : leurs cultures sont listées sans bilan hydrique ni dose ; conseil à revoir plus tard.`
    : "Météo momentanément indisponible pour 1 zone : ses cultures sont listées sans bilan hydrique ni dose ; conseil à revoir plus tard."
}

/**
 * Une ligne calculée sans météo n'a ni bilan sur 7 jours ni compteur de
 * jours sans pluie : la route y met 0, qui se lirait « 0 mm, 0 j sans pluie ».
 */
export function afficheMesuresMeteo(reco: { sansMeteo?: CauseSansMeteo | null }): boolean {
  return !reco.sansMeteo
}
