type PlancheDimensions = {
  surface?: number | null
  largeur?: number | null
  longueur?: number | null
}

type CultureDimensions = {
  longueur?: number | null
  planche?: PlancheDimensions | null
}

/**
 * Surface réellement allouée à une culture.
 *
 * `Culture.longueur` représente la portion cultivée de la planche. Quand elle
 * est renseignée, elle prime donc sur `Planche.surface`, qui décrit la capacité
 * totale de la planche et non l'occupation de cette culture.
 */
export function surfaceCultureM2(culture: CultureDimensions): number {
  const largeur = Number(culture.planche?.largeur ?? 0)
  const longueurCulture = Number(culture.longueur ?? 0)
  if (largeur > 0 && longueurCulture > 0) {
    return largeur * longueurCulture
  }

  const surfacePlanche = Number(culture.planche?.surface ?? 0)
  if (surfacePlanche > 0) return surfacePlanche

  const longueurPlanche = Number(culture.planche?.longueur ?? 0)
  return largeur > 0 && longueurPlanche > 0 ? largeur * longueurPlanche : 0
}
