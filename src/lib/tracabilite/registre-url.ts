/**
 * Registre affiché par /tracabilite et son année, portés par l'URL.
 *
 * Ticket QA cmvntzwng (2026-10-25) : « Registre de culture » choisi, puis F5 :
 * retour au registre phytosanitaire, l'URL restée `/tracabilite`. L'onglet
 * vivait dans un état local (depuis le 2026-05-14), l'année aussi. Les deux
 * sont désormais dans la requête (`?registre=culture&annee=2027`) : lus au
 * montage, réécrits par `history.replaceState(null, …)` à chaque choix (motif 7
 * du registre des bugs : jamais `router.replace` sur le même chemin, jamais
 * l'état de Next), le reste de la requête et l'ancre gardés.
 *
 * La valeur est l'identifiant technique de l'onglet, jamais son libellé. Une
 * valeur inconnue ou une année hors plage retombent sur le défaut.
 */

import { resolveDashboardYear } from "@/lib/dashboard-year"

export const REGISTRES_TRACABILITE = ["phyto", "culture", "sanitaire", "elevage"] as const

export type RegistreTracabilite = (typeof REGISTRES_TRACABILITE)[number]

export const REGISTRE_PAR_DEFAUT: RegistreTracabilite = "phyto"

export const PARAM_REGISTRE = "registre"
export const PARAM_ANNEE = "annee"

export interface EtatTracabilite {
  registre: RegistreTracabilite
  annee: number
}

/** Registre désigné par la valeur d'URL ; le registre phytosanitaire sinon. */
export function lireRegistre(valeur: string | null | undefined): RegistreTracabilite {
  const v = (valeur ?? "").trim().toLowerCase()
  return (REGISTRES_TRACABILITE as readonly string[]).includes(v)
    ? (v as RegistreTracabilite)
    : REGISTRE_PAR_DEFAUT
}

/** Registre et année de la requête (`window.location.search`), avec leurs replis. */
export function lireEtatTracabilite(
  search: string,
  options: { annees: readonly number[]; anneeParDefaut: number },
): EtatTracabilite {
  const sp = new URLSearchParams(search)
  return {
    registre: lireRegistre(sp.get(PARAM_REGISTRE)),
    annee: resolveDashboardYear({
      queryValue: sp.get(PARAM_ANNEE)?.trim() ?? null,
      fallbackYear: options.anneeParDefaut,
      allowedYears: options.annees,
    }),
  }
}

/**
 * URL de l'écran pour cet état : `registre` et `annee` posés, tout autre
 * paramètre et l'ancre conservés.
 */
export function urlTracabilite(
  emplacement: { pathname: string; search: string; hash: string },
  etat: EtatTracabilite,
): string {
  const sp = new URLSearchParams(emplacement.search)
  sp.set(PARAM_REGISTRE, etat.registre)
  sp.set(PARAM_ANNEE, String(etat.annee))
  return `${emplacement.pathname}?${sp.toString()}${emplacement.hash}`
}
