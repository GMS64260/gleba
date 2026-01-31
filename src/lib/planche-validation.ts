/**
 * Validation de l'occupation des planches
 * Vérifie si une culture peut tenir dans une planche
 */

interface CultureOccupation {
  nbRangs: number
  espacementRangs: number // en cm
  longueur?: number // en mètres (longueur de la culture)
}

interface PlancheData {
  largeur: number // en mètres
  longueur: number // en mètres
}

/**
 * Calcule la largeur occupée par une culture
 */
export function calculerLargeurOccupee(culture: CultureOccupation): number {
  if (!culture.nbRangs || culture.nbRangs <= 1) return 0.1 // Minimum 10cm
  // Largeur = (nb rangs - 1) × espacement entre rangs
  return ((culture.nbRangs - 1) * culture.espacementRangs) / 100 // Convertir cm en m
}

/**
 * Vérifie si une culture peut être ajoutée à une planche
 */
export function peutAjouterCulture(
  planche: PlancheData,
  culturesExistantes: CultureOccupation[],
  nouvelleCulture: CultureOccupation
): {
  possible: boolean
  largeurDisponible: number
  largeurNecessaire: number
  largeurOccupee: number
  message?: string
} {
  const largeurPlanche = planche.largeur
  const longueurPlanche = planche.longueur

  // Vérifier la longueur si fournie
  if (nouvelleCulture.longueur && nouvelleCulture.longueur > longueurPlanche) {
    return {
      possible: false,
      largeurDisponible: 0,
      largeurNecessaire: 0,
      largeurOccupee: 0,
      message: `Longueur de culture (${nouvelleCulture.longueur}m) supérieure à la longueur de la planche (${longueurPlanche}m)`,
    }
  }

  // Calculer la largeur déjà occupée
  const largeurOccupee = culturesExistantes.reduce(
    (sum, c) => sum + calculerLargeurOccupee(c),
    0
  )

  // Largeur nécessaire pour la nouvelle culture
  const largeurNecessaire = calculerLargeurOccupee(nouvelleCulture)

  // Largeur disponible (avec marge de 10cm de chaque côté)
  const largeurDisponible = largeurPlanche - largeurOccupee - 0.2

  const possible = largeurNecessaire <= largeurDisponible

  let message
  if (!possible) {
    const deficit = largeurNecessaire - largeurDisponible
    message = `Largeur insuffisante : besoin de ${largeurNecessaire.toFixed(2)}m, disponible ${largeurDisponible.toFixed(2)}m (manque ${deficit.toFixed(2)}m)`
  }

  return {
    possible,
    largeurDisponible,
    largeurNecessaire,
    largeurOccupee,
    message,
  }
}

/**
 * Suggestions pour faire rentrer la culture
 */
export function suggererAjustements(
  planche: PlancheData,
  culturesExistantes: CultureOccupation[],
  nouvelleCulture: CultureOccupation
): {
  reduireRangs?: number
  reduireEspacement?: number
  message: string
}[] {
  const suggestions: Array<{
    reduireRangs?: number
    reduireEspacement?: number
    message: string
  }> = []

  const check = peutAjouterCulture(planche, culturesExistantes, nouvelleCulture)

  if (check.possible) return suggestions

  // Suggestion 1 : Réduire le nombre de rangs
  for (let rangs = nouvelleCulture.nbRangs - 1; rangs >= 1; rangs--) {
    const test = peutAjouterCulture(planche, culturesExistantes, {
      ...nouvelleCulture,
      nbRangs: rangs,
    })
    if (test.possible) {
      suggestions.push({
        reduireRangs: rangs,
        message: `Réduire à ${rangs} rang${rangs > 1 ? 's' : ''} (au lieu de ${nouvelleCulture.nbRangs})`,
      })
      break
    }
  }

  // Suggestion 2 : Réduire l'espacement entre rangs
  const espacementsTests = [40, 35, 30, 25, 20, 15]
  for (const esp of espacementsTests) {
    if (esp >= nouvelleCulture.espacementRangs) continue
    const test = peutAjouterCulture(planche, culturesExistantes, {
      ...nouvelleCulture,
      espacementRangs: esp,
    })
    if (test.possible) {
      suggestions.push({
        reduireEspacement: esp,
        message: `Réduire l'espacement à ${esp}cm (au lieu de ${nouvelleCulture.espacementRangs}cm)`,
      })
      break
    }
  }

  // Suggestion 3 : Utiliser une autre planche
  if (suggestions.length === 0) {
    suggestions.push({
      message: "Utiliser une planche plus large ou créer une nouvelle planche",
    })
  }

  return suggestions
}
