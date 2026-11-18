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

/** Pourquoi le bloc nappe du conseiller n'a rien à montrer. */
export type NappeIndisponible = "aucune-station" | "panne"

/**
 * Lecture d'un échec de `/api/meteo/nappe` : 404 = aucune station exploitable
 * autour de la parcelle ; tout le reste (panne Hub'Eau, erreur serveur,
 * réseau : `statut` null) est une indisponibilité passagère. Sans cela, seuls
 * 404 et 503 étaient dits, les autres échecs effaçaient le bloc sans un mot.
 */
export function etatNappeIndisponible(statut: number | null): NappeIndisponible {
  return statut === 404 ? "aucune-station" : "panne"
}

/** Le rayon est celui de la recherche (`fetchNappeInfo`, `src/lib/hubeau.ts`) : 100 km. */
export function phraseNappeIndisponible(etat: NappeIndisponible): string {
  return etat === "aucune-station"
    ? "Nappe : aucune station Hub'Eau avec des relevés récents dans un rayon de 100 km."
    : "Nappe : niveau momentanément indisponible (service Hub'Eau)."
}
