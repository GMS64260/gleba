/**
 * Validation de l'occupation des planches
 * Vérifie si une culture peut tenir dans une planche
 */

interface CultureOccupation {
  nbRangs: number
  /**
   * Espacement ENTRE RANGS en cm, ou `null` quand l'itinéraire technique ne le
   * renseigne pas. QA cmsqla9c2 : cette valeur était auparavant remplacée par
   * un 30 cm inventé, ce qui refusait des cultures parfaitement banales (4 rangs
   * de radis sur une planche de 80 cm) au nom d'un chiffre que l'utilisateur ne
   * voyait nulle part et ne pouvait pas corriger. On ne compte plus que ce qu'on
   * sait vraiment.
   */
  espacementRangs: number | null
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
  // Espacement inconnu : on compte l'emprise minimale plutôt qu'un espacement
  // inventé, qui gonflerait l'occupation et ferait refuser une culture voisine.
  if (culture.espacementRangs == null) return 0.1
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

  // Largeur necessaire pour la nouvelle culture
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
  const espacementActuel = nouvelleCulture.espacementRangs
  const espacementsTests = espacementActuel == null ? [] : [40, 35, 30, 25, 20, 15]
  for (const esp of espacementsTests) {
    if (espacementActuel == null || esp >= espacementActuel) continue
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
