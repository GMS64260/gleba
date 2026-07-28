/**
 * Politique de consultation admin en lecture seule.
 *
 * La plupart des GET sont de simples lectures, mais quelques routes historiques
 * mettent à jour des irrigations ou créent un journal d'export. Elles doivent
 * donc être refusées pendant une impersonation, au même titre qu'une mutation.
 */

const GET_AVEC_EFFET_DE_BORD = [
  "/api/auth/verify",
  "/api/calendrier",
  "/api/taches",
  "/api/cultures/irriguer",
  "/api/elevage/inventaire-cheptel",
  "/api/elevage/declarations-reglementaires/export",
  "/api/elevage/declarations-reglementaires/document-circulation",
  "/api/elevage/registre-elevage",
  "/api/elevage/registre-elevage-complet",
  "/api/elevage/registres-archives",
  "/api/elevage/registre-sanitaire",
] as const

function correspondAuChemin(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

export function estSurfaceAdministration(pathname: string): boolean {
  return correspondAuChemin(pathname, "/admin")
    || correspondAuChemin(pathname, "/api/admin")
}

export type MotifInterdictionConsultation =
  | "ADMINISTRATION"
  | "MUTATION"
  | "GET_AVEC_EFFET_DE_BORD"

export function motifInterdictionConsultation(
  pathname: string,
  method: string,
): MotifInterdictionConsultation | null {
  if (estSurfaceAdministration(pathname)) return "ADMINISTRATION"

  const methode = method.toUpperCase()
  // Quitter la consultation doit rester possible : cette requête ne modifie
  // aucune donnée du compte cible, elle détruit seulement la session courante.
  if (pathname === "/api/auth/signout" && methode === "POST") return null
  if (!["GET", "HEAD", "OPTIONS"].includes(methode)) return "MUTATION"
  if (
    methode !== "OPTIONS"
    && GET_AVEC_EFFET_DE_BORD.some((route) => correspondAuChemin(pathname, route))
  ) {
    return "GET_AVEC_EFFET_DE_BORD"
  }
  return null
}
