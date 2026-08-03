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

export function latitudeValide(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90
}

export function longitudeValide(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180
}

/**
 * Message d'erreur circonstancié pour un couple de coordonnées, ou null si le
 * couple est acceptable (les deux renseignés et dans les bornes, ou les deux
 * absents).
 *
 * Nomme le champ et la valeur fautive : une fiche héritant d'une longitude hors
 * bornes devenait insauvegardable, et le message générique « coordonnées
 * invalides » apparaissait en modifiant un champ sans rapport (constat de
 * production du 2026-08-03).
 */
export function messageErreurCoordonnees(
  lat: number | null,
  lng: number | null
): string | null {
  if ((lat == null) !== (lng == null)) {
    return "Les coordonnées GPS sont incomplètes : latitude et longitude doivent être renseignées ensemble, ou vides toutes les deux."
  }
  if (lat == null || lng == null) return null

  const fautives: string[] = []
  if (!latitudeValide(lat)) fautives.push(`latitude ${lat} (attendu entre -90 et 90)`)
  if (!longitudeValide(lng)) fautives.push(`longitude ${lng} (attendu entre -180 et 180)`)
  if (fautives.length === 0) return null

  return `Coordonnées GPS hors limites : ${fautives.join(" et ")}. Vérifiez le séparateur décimal, puis relevez la position ou videz les deux champs.`
}

/**
 * Tente de récupérer une coordonnée dont le point décimal a été perdu à la
 * saisie (« -0.563888 » stocké « -563888 »), en s'appuyant sur une position de
 * référence — les parcelles ou les autres arbres du compte.
 *
 * On n'invente rien : on essaie les remises à l'échelle par puissances de dix et
 * on ne retient que celle qui retombe près de la référence. Choisir « la
 * première valeur dans les bornes » serait faux : -563888 donne -5.63888 dès la
 * cinquième division, soit l'Atlantique au large de l'Espagne, alors que la
 * bonne récupération est -0.563888.
 *
 * Retourne null si aucune remise à l'échelle n'est corroborée : la coordonnée
 * doit alors être relevée à nouveau, pas devinée.
 */
export function recupererCoordonneeDecalee(params: {
  valeur: number
  reference: number
  max: number
  /** Écart maximal admis avec la référence, en degrés. */
  toleranceDegres?: number
}): number | null {
  const { valeur, reference, max, toleranceDegres = 0.05 } = params
  if (!Number.isFinite(valeur) || Math.abs(valeur) <= max) return null

  let meilleure: { candidate: number; ecart: number } | null = null
  for (let k = 1; k <= 9; k++) {
    const candidate = valeur / 10 ** k
    if (Math.abs(candidate) > max) continue
    const ecart = Math.abs(candidate - reference)
    if (!meilleure || ecart < meilleure.ecart) meilleure = { candidate, ecart }
  }

  if (!meilleure || meilleure.ecart > toleranceDegres) return null
  return roundCoord(meilleure.candidate)
}
