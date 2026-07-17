/**
 * Géolocalisation navigateur — helpers partagés.
 *
 * Feedback LVBB40430 (2026-07-15) : saisir les coordonnées GPS de chaque
 * arbre obligeait à les relever dans une autre application puis à les
 * recopier. On expose ici une capture de position en un geste, réutilisée
 * par le bouton « Ma position », le sélecteur carte et le relevé en série.
 */

export interface GpsFix {
  lat: number
  lng: number
  /** Précision estimée en mètres (rayon d'incertitude). */
  accuracy: number
}

export function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Accès à la géolocalisation refusé. Autorisez la localisation pour gleba.fr dans les réglages du navigateur."
    case error.POSITION_UNAVAILABLE:
      return "Position indisponible (signal GPS faible ?)."
    case error.TIMEOUT:
      return "Délai de géolocalisation dépassé. Réessayez, si possible à découvert."
    default:
      return "Impossible de déterminer votre position."
  }
}

/**
 * Capture une position fraîche (maximumAge: 0 — on relève arbre par arbre,
 * un fix en cache d'il y a une minute serait celui de l'arbre précédent).
 */
export function getCurrentGpsFix(options?: PositionOptions): Promise<GpsFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("La géolocalisation n'est pas supportée par votre navigateur."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (error) => reject(new Error(geolocationErrorMessage(error))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0, ...options }
    )
  })
}

/** Arrondi à 6 décimales (≈ 11 cm) : suffisant pour un arbre, valeurs lisibles. */
export function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6
}
