/** Choix local partagé par le bandeau et l'opposition à la mesure d'audience. */
export const CLE_CHOIX_COOKIES = "gleba-cookie-consent"
export const EVENEMENT_CHOIX_COOKIES = "gleba-cookie-consent-change"

export function lireChoixCookies(): Record<string, unknown> | null {
  const choix: unknown = JSON.parse(localStorage.getItem(CLE_CHOIX_COOKIES) || "null")
  return choix && typeof choix === "object" && !Array.isArray(choix)
    ? choix as Record<string, unknown>
    : null
}

export function mesureAudienceRefusee(): boolean {
  try {
    return lireChoixCookies()?.analytics === false
  } catch {
    // Stockage inaccessible ou illisible : ne pas risquer d'ignorer un refus.
    return true
  }
}

export function enregistrerChoixCookies(choix: Record<string, unknown>): void {
  localStorage.setItem(CLE_CHOIX_COOKIES, JSON.stringify(choix))
  window.dispatchEvent(new Event(EVENEMENT_CHOIX_COOKIES))
}
