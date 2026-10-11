/**
 * Validation de l'occupation des planches
 * Vérifie si une culture peut tenir dans une planche
 */

import { chevauchePeriode, type CycleCulture } from '@/lib/cultures/fenetre-recolte'

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

  // Tolérance d'arrondi : 0,90 − 0,20 − 0,20 vaut 0,4999… en flottant, et un
  // besoin d'exactement 0,50 m était refusé (revue du 2026-10-11).
  const possible = largeurNecessaire <= largeurDisponible + 1e-9

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

/** Culture déjà en place sur la planche, telle que la lit `evaluerOccupationPlanche`. */
export interface CulturePlancheOccupation extends CycleCulture {
  nbRangs: number | null
  itp?: { espacementRangs: number | null } | null
}

export interface AjustementOccupation {
  reduireRangs?: number
  reduireEspacement?: number
  message: string
}

export type VerdictOccupation =
  | {
      /** Espacement entre rangs inconnu pour l'ITP : la largeur n'est pas vérifiée. */
      verifie: false
      possible: true
      avertissement: string
      /**
       * La longueur, elle, se compare toujours : une culture plus longue que la
       * planche est signalée même sans espacement connu (revue du 2026-10-11 :
       * l'aperçu de l'assistant le disait avant l'alignement sur le serveur).
       */
      longueurExcedentaire: string | null
      largeurPlanche: number
    }
  | {
      verifie: true
      possible: boolean
      message?: string
      ajustements: AjustementOccupation[]
      largeurPlanche: number
      largeurDisponible: number
      largeurNecessaire: number
      largeurOccupee: number
      espacementRangs: number
    }

/** Repli historique des dimensions d'une planche non renseignée. */
export const LARGEUR_PLANCHE_DEFAUT = 0.8
export const LONGUEUR_PLANCHE_DEFAUT = 2

export const AVERTISSEMENT_ESPACEMENT_INCONNU =
  "Espacement entre rangs inconnu pour cet itinéraire technique : l'occupation de la planche n'a pas été vérifiée."

/**
 * Verdict d'occupation d'une planche pour une nouvelle culture : LA règle, pour
 * la création (POST /api/cultures) comme pour l'aperçu de l'assistant.
 *
 * QA cmv2r1v63 (2026-10-10) — l'assistant recalculait l'occupation de son côté :
 * 30 cm inventés pour l'espacement des cultures en place (le serveur ne compte
 * que ce qu'il sait, QA cmsqla9c2), toutes les cultures non terminées au lieu
 * de celles qui chevauchent la période (QA cmsp5927v). Son verdict et ses
 * suggestions pouvaient donc contredire le refus du serveur.
 *
 * - Seules comptent les cultures dont le cycle chevauche [debut, fin] ; sans
 *   dates exploitables d'un côté ou de l'autre, la culture est comptée.
 * - Sans espacement entre rangs pour l'ITP de la nouvelle culture, la largeur
 *   n'est pas vérifiée (avertissement) ; une longueur excédentaire est dite.
 */
export function evaluerOccupationPlanche(args: {
  planche: { largeur: number | null; longueur: number | null }
  /** Cultures non terminées de la planche. */
  culturesEnPlace: CulturePlancheOccupation[]
  /** Espacement entre rangs de l'ITP de la nouvelle culture (cm). */
  espacementRangs: number | null
  nbRangs: number | null | undefined
  longueur: number | null | undefined
  debut: Date | null
  fin: Date | null
}): VerdictOccupation {
  const dimensions = {
    largeur: args.planche.largeur || LARGEUR_PLANCHE_DEFAUT,
    longueur: args.planche.longueur || LONGUEUR_PLANCHE_DEFAUT,
  }
  if (args.espacementRangs == null) {
    return {
      verifie: false,
      possible: true,
      avertissement: AVERTISSEMENT_ESPACEMENT_INCONNU,
      // Longueur réelle seulement : le repli de 2 m ferait signaler toute
      // culture d'une planche dont la longueur n'est pas saisie.
      longueurExcedentaire:
        args.longueur && args.planche.longueur && args.longueur > args.planche.longueur
          ? `Longueur de culture (${args.longueur}m) supérieure à la longueur de la planche (${args.planche.longueur}m)`
          : null,
      largeurPlanche: dimensions.largeur,
    }
  }
  const { debut, fin } = args
  const existantes = args.culturesEnPlace
    .filter((c) => !debut || !fin || (chevauchePeriode(c, debut, fin) ?? true))
    .map((c) => ({ nbRangs: c.nbRangs || 1, espacementRangs: c.itp?.espacementRangs ?? null }))
  const nouvelle = {
    nbRangs: args.nbRangs || 1,
    espacementRangs: args.espacementRangs,
    longueur: args.longueur || undefined,
  }
  const validation = peutAjouterCulture(dimensions, existantes, nouvelle)
  return {
    verifie: true,
    possible: validation.possible,
    message: validation.message,
    ajustements: validation.possible ? [] : suggererAjustements(dimensions, existantes, nouvelle),
    largeurPlanche: dimensions.largeur,
    largeurDisponible: validation.largeurDisponible,
    largeurNecessaire: validation.largeurNecessaire,
    largeurOccupee: validation.largeurOccupee,
    espacementRangs: args.espacementRangs,
  }
}
