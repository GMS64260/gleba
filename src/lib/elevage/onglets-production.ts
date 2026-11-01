/**
 * Sous-onglets d'Élevage > Production et liens directs `?tab=production&sub=…`.
 *
 * Revue du 2026-11-01 : `ProductionTab` ignorait `sub` et ouvrait l'onglet
 * mémorisé ou celui du profil du cheptel (Œufs, Lait) ; un lien vers les
 * ventes n'y menait donc pas.
 */

export const ONGLETS_PRODUCTION = ["oeufs", "lait", "ruche", "ventes", "abattages", "economie"] as const
export type OngletProduction = (typeof ONGLETS_PRODUCTION)[number]

/** Sous-onglets de Lait ; « fromage » est l'ancien alias de la cave. */
export const ONGLETS_LAIT = ["collecte", "fabrications", "lactation", "qualite", "palmares", "livraisons", "cave"] as const
export type OngletLait = (typeof ONGLETS_LAIT)[number]

/** Onglet de Production visé par `sub`, ou `null` si le lien n'en vise aucun. */
export function ongletProductionDepuisSub(sub: string | null | undefined): OngletProduction | null {
  if (!sub) return null
  if ((ONGLETS_PRODUCTION as readonly string[]).includes(sub)) return sub as OngletProduction
  if (sub === "fromage" || (ONGLETS_LAIT as readonly string[]).includes(sub)) return "lait"
  return null
}

/** Sous-onglet de Lait visé par `sub`, ou `null`. */
export function ongletLaitDepuisSub(sub: string | null | undefined): OngletLait | null {
  if (sub === "fromage") return "cave"
  return sub && (ONGLETS_LAIT as readonly string[]).includes(sub) ? (sub as OngletLait) : null
}
