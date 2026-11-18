/**
 * Validation de l'occupation des planches
 * Vérifie si une culture peut tenir dans une planche
 */

import {
  chevauchePeriode,
  chevauchePeriodeOuverte,
  debutOccupation,
  estVivaceEnPlace,
  finDeCycle,
  type CycleCulture,
} from '@/lib/cultures/fenetre-recolte'

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

/** Tolérance d'arrondi des comparaisons de longueurs et de largeurs (m). */
const TOLERANCE = 1e-9

/** Culture qui n'occupe qu'une portion de la longueur de la planche. */
function estPartielle(culture: CultureOccupation, longueurPlanche: number): boolean {
  return culture.longueur != null && culture.longueur > 0 && culture.longueur < longueurPlanche - TOLERANCE
}

/**
 * Largeur que les cultures en place retirent à une nouvelle culture.
 *
 * Revue du 2026-11-11 — les largeurs étaient additionnées sans regarder les
 * longueurs : sur une planche de 20 m, une culture de 10 m faisait refuser sa
 * voisine posée sur les 10 m restants, alors qu'elles ne sont pas côte à côte.
 * Assouplissement volontairement prudent. La position des cultures sur la
 * planche n'est pas enregistrée ; un seul cas est donc sûr :
 * - une nouvelle culture partielle dont la longueur, ajoutée à celles des
 *   cultures partielles en place, tient dans la planche : elle se loge à la
 *   suite et ne compte que les cultures en place sur toute la longueur (ou de
 *   longueur inconnue) ;
 * - dans tous les autres cas, les largeurs s'additionnent comme avant.
 *
 * Relecture du 2026-11-12 — une première version réduisait aussi les
 * partielles en place à « la plus large d'entre elles » face à une culture
 * pleine longueur. Deux partielles de 10 m posées côte à côte sur les mêmes
 * 10 m (ce que la somme autorisait) laissaient alors accepter une troisième
 * bande qui ne tenait pas sur ce tronçon.
 * Le résultat n'est jamais plus strict que l'ancienne somme.
 */
export function largeurPriseParLesCulturesEnPlace(
  planche: PlancheData,
  culturesExistantes: CultureOccupation[],
  nouvelleCulture: CultureOccupation
): number {
  return culturesQuiPrennentLaLargeur(planche, culturesExistantes, nouvelleCulture).reduce(
    (total, c) => total + calculerLargeurOccupee(c),
    0
  )
}

/**
 * Cultures en place dont la largeur est retirée à la nouvelle culture (règle
 * de `largeurPriseParLesCulturesEnPlace`) : les mêmes objets, filtrés.
 */
function culturesQuiPrennentLaLargeur<T extends CultureOccupation>(
  planche: PlancheData,
  culturesExistantes: T[],
  nouvelleCulture: CultureOccupation
): T[] {
  if (!estPartielle(nouvelleCulture, planche.longueur)) return culturesExistantes

  const partielles = culturesExistantes.filter((c) => estPartielle(c, planche.longueur))
  const longueurPartielles = partielles.reduce((total, c) => total + (c.longueur ?? 0), 0)
  const tientALaSuite =
    longueurPartielles + (nouvelleCulture.longueur ?? 0) <= planche.longueur + TOLERANCE
  if (!tientALaSuite) return culturesExistantes
  return culturesExistantes.filter((c) => !estPartielle(c, planche.longueur))
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

  // Largeur déjà occupée en regard de la nouvelle culture
  const largeurOccupee = largeurPriseParLesCulturesEnPlace(planche, culturesExistantes, nouvelleCulture)

  // Largeur necessaire pour la nouvelle culture
  const largeurNecessaire = calculerLargeurOccupee(nouvelleCulture)

  // Largeur disponible (avec marge de 10cm de chaque côté)
  const largeurDisponible = largeurPlanche - largeurOccupee - 0.2

  // Tolérance d'arrondi : 0,90 − 0,20 − 0,20 vaut 0,4999… en flottant, et un
  // besoin d'exactement 0,50 m était refusé (revue du 2026-10-11).
  const possible = largeurNecessaire <= largeurDisponible + TOLERANCE

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
  /** Portion cultivée de la planche (m) ; absente ou nulle : toute la longueur. */
  longueur?: number | null
  itp?: { espacementRangs: number | null } | null
}

/** Avertissements non bloquants, indépendants de la largeur disponible. */
export function avertissementsChevauchementPlanche(args: {
  culturesEnPlace: (CycleCulture & { id: number; espece?: { id: string; vivace?: boolean | null } | null })[]
  debut: Date | null
  fin: Date | null
  /** La nouvelle vivace occupe la planche sans fin de cycle. */
  vivace?: boolean
}): string[] {
  const { debut, fin, vivace } = args
  if (!debut || (!fin && !vivace)) return []
  const fmt = (d: Date | string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  return args.culturesEnPlace.flatMap((culture) => {
    const chevauche = vivace ? chevauchePeriodeOuverte(culture, debut) : chevauchePeriode(culture, debut, fin!)
    if (chevauche !== true) return []
    const debutCulture = debutOccupation(culture)!
    const periode = estVivaceEnPlace(culture)
      ? `en place depuis le ${fmt(debutCulture)}, vivace`
      : `${fmt(debutCulture)}–${fmt(finDeCycle(culture)!)}`
    return [`Chevauchement détecté sur la planche : ${culture.espece?.id || 'culture'} #${culture.id} (${periode}) recouvre la période demandée.`]
  })
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
 * Voisines simultanées pendant la période évaluée : un groupe par instant où
 * l'une d'elles arrive sur la planche (et au début de la période).
 *
 * Revue adverse du 2026-11-15 (ADV39) — toutes les voisines qui chevauchaient
 * la période étaient additionnées, même lorsqu'elles se succèdent sans jamais
 * se croiser : une vivace replacée en janvier, face à une annuelle de mars à
 * avril puis une autre de juin à août, se voyait refuser 0,25 m alors qu'elle
 * ne côtoie jamais qu'une seule des deux. L'occupation maximale est atteinte à
 * l'arrivée d'une culture : il suffit d'examiner ces instants.
 *
 * - `fin` null : période ouverte (vivace).
 * - Une voisine dont les dates ne permettent pas de conclure est présente à
 *   tout instant (prudence) ; sans `debut`, toutes forment un seul groupe.
 */
function groupesSimultanes(
  voisines: CulturePlancheOccupation[],
  debut: Date | null,
  fin: Date | null
): CulturePlancheOccupation[][] {
  if (!debut || voisines.length === 0) return [voisines]
  const instants = new Set<number>([debut.getTime()])
  for (const c of voisines) {
    const arrivee = debutOccupation(c)?.getTime()
    if (arrivee == null || Number.isNaN(arrivee)) continue
    if (arrivee > debut.getTime() && (!fin || arrivee < fin.getTime())) instants.add(arrivee)
  }
  const groupes = new Map<string, CulturePlancheOccupation[]>()
  for (const t of instants) {
    // Instant t : intervalle [t, t + 1 ms[ au sens de `chevauchePeriode`.
    const groupe = voisines.filter((c) => chevauchePeriode(c, new Date(t), new Date(t + 1)) ?? true)
    groupes.set(groupe.map((c) => voisines.indexOf(c)).join(','), groupe)
  }
  return [...groupes.values()]
}

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
 * - Une culture partielle qui tient à la suite des partielles en place ne
 *   leur prend aucune largeur (`largeurPriseParLesCulturesEnPlace`).
 * - Sans espacement entre rangs pour l'ITP de la nouvelle culture, la largeur
 *   n'est pas vérifiée (avertissement) ; une longueur excédentaire est dite.
 */
export function evaluerOccupationPlanche(args: ArgsOccupation): VerdictOccupation {
  return evaluerParTranches(args).verdict
}

interface ArgsOccupation {
  planche: { largeur: number | null; longueur: number | null }
  /** Cultures non terminées de la planche. */
  culturesEnPlace: CulturePlancheOccupation[]
  /** Espacement entre rangs de l'ITP de la nouvelle culture (cm). */
  espacementRangs: number | null
  nbRangs: number | null | undefined
  longueur: number | null | undefined
  debut: Date | null
  fin: Date | null
  /**
   * La culture évaluée est une vivace (`estVivaceEnPlace`) : elle occupe la
   * planche à partir de `debut` sans fin de cycle, `fin` est ignorée.
   */
  vivace?: boolean
}

/**
 * `evaluerOccupationPlanche`, avec le détail des tranches en dépassement :
 * pour chacune, les voisines qui prennent réellement de la largeur à la
 * culture évaluée (une partielle logée bout à bout n'en fait pas partie).
 */
function evaluerParTranches(args: ArgsOccupation): {
  verdict: VerdictOccupation
  conflits: Set<CulturePlancheOccupation>[]
} {
  const conflits: Set<CulturePlancheOccupation>[] = []
  const dimensions = {
    largeur: args.planche.largeur || LARGEUR_PLANCHE_DEFAUT,
    longueur: args.planche.longueur || LONGUEUR_PLANCHE_DEFAUT,
  }
  if (args.espacementRangs == null) {
    const verdict: VerdictOccupation = {
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
    return { verdict, conflits }
  }
  const { debut, fin } = args
  const chevauche = (c: CulturePlancheOccupation) => {
    if (!debut) return true
    if (args.vivace) return chevauchePeriodeOuverte(c, debut) ?? true
    return !fin || (chevauchePeriode(c, debut, fin) ?? true)
  }
  const versOccupation = (c: CulturePlancheOccupation) => ({
    nbRangs: c.nbRangs || 1,
    espacementRangs: c.itp?.espacementRangs ?? null,
    // Sans longueur de planche saisie, le repli de 2 m ne dit rien de la
    // place réelle : les cultures en place comptent sur toute la longueur.
    longueur: args.planche.longueur ? c.longueur || undefined : undefined,
  })
  const nouvelle = {
    nbRangs: args.nbRangs || 1,
    espacementRangs: args.espacementRangs,
    longueur: args.longueur || undefined,
  }
  // La capacité se juge sur chaque tranche de temps où des voisines sont
  // réellement simultanées : la plus chargée fait le verdict. Annuelle sans
  // fin de cycle : prudence, toutes les voisines comptent ensemble.
  const enRegard = args.culturesEnPlace.filter(chevauche)
  const groupes =
    args.vivace || fin ? groupesSimultanes(enRegard, debut, args.vivace ? null : fin) : [enRegard]
  let validation: ReturnType<typeof peutAjouterCulture> | null = null
  let existantes: ReturnType<typeof versOccupation>[] = []
  for (const groupe of groupes) {
    const occupation = groupe.map(versOccupation)
    const essai = peutAjouterCulture(dimensions, occupation, nouvelle)
    if (!essai.possible) {
      const prises = new Set(culturesQuiPrennentLaLargeur(dimensions, occupation, nouvelle))
      conflits.push(new Set(groupe.filter((_, i) => prises.has(occupation[i]))))
    }
    if (!validation || essai.largeurOccupee > validation.largeurOccupee + TOLERANCE) {
      validation = essai
      existantes = occupation
    }
  }
  validation ??= peutAjouterCulture(dimensions, existantes, nouvelle)
  const verdict: VerdictOccupation = {
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
  return { verdict, conflits }
}

/** État d'une culture vis-à-vis de sa planche, avant ou après modification. */
export interface EtatOccupationCulture {
  /** Espacement entre rangs de son ITP (cm). */
  espacementRangs: number | null
  nbRangs: number | null | undefined
  longueur: number | null | undefined
  debut: Date | null
  fin: Date | null
  /** Vivace en place : occupe la planche à partir de `debut`, sans fin. */
  vivace?: boolean
}

/**
 * Verdict d'occupation pour la MODIFICATION d'une culture : le refus à rendre,
 * ou null quand la modification passe.
 *
 * Relecture du 2026-11-12 — seule la création contrôlait l'occupation : une
 * culture de 1 m logée à la suite d'une autre pouvait être étendue à toute la
 * planche par simple édition. La règle est celle de la création, appliquée à
 * l'état final, avec une réserve : une culture déjà en dépassement reste
 * modifiable tant que la modification ne lui fait prendre ni plus de largeur,
 * ni plus de voisines (corriger une date, réduire une longueur ou des rangs).
 * ADV39 : la largeur occupée étant celle de la tranche la plus chargée, « plus
 * de voisines » se juge sur les voisines des tranches en dépassement, une à une.
 *
 * Revues ADV106 / QA105 (2026-11-15) — comparer le maximum global et l'union
 * des voisines de toutes les tranches masquait une aggravation locale (une
 * tranche passant de 0,75 m à 1 m sous le maximum d'une autre) et comptait
 * comme conflit une partielle logée bout à bout, qui ne prend aucune largeur.
 * Désormais, chaque tranche en dépassement après modification doit être
 * couverte par une tranche en dépassement avant : ses voisines qui prennent
 * réellement de la largeur sont un sous-ensemble de celles d'une même tranche
 * d'avant (donc une largeur occupée au plus égale), et la largeur nécessaire
 * ne grandit pas.
 *
 * - `autresCultures` : cultures non terminées de la planche d'arrivée, sans la
 *   culture modifiée.
 * - `avant` : son état sur cette même planche, ou null si elle y arrive.
 * - Une longueur supérieure à celle de la planche compte pour toute la
 *   longueur : l'excédent est un avertissement de l'édition, pas un refus.
 */
export function evaluerModificationOccupation(args: {
  planche: { largeur: number | null; longueur: number | null }
  autresCultures: CulturePlancheOccupation[]
  avant: EtatOccupationCulture | null
  apres: EtatOccupationCulture
}): Extract<VerdictOccupation, { verifie: true }> | null {
  const verdict = (etat: EtatOccupationCulture) =>
    evaluerParTranches({
      planche: args.planche,
      culturesEnPlace: args.autresCultures,
      espacementRangs: etat.espacementRangs,
      nbRangs: etat.nbRangs,
      longueur:
        etat.longueur && args.planche.longueur && etat.longueur > args.planche.longueur
          ? null
          : etat.longueur,
      debut: etat.debut,
      fin: etat.fin,
      vivace: etat.vivace,
    })

  const tranchesApres = verdict(args.apres)
  const apres = tranchesApres.verdict
  if (!apres.verifie || apres.possible) return null
  if (!args.avant) return apres

  const tranchesAvant = verdict(args.avant)
  const avant = tranchesAvant.verdict
  if (!avant.verifie || avant.possible) return apres
  const couverte = (conflit: Set<CulturePlancheOccupation>) =>
    tranchesAvant.conflits.some((acquis) => [...conflit].every((c) => acquis.has(c)))
  const aggravee =
    apres.largeurNecessaire > avant.largeurNecessaire + TOLERANCE ||
    !tranchesApres.conflits.every(couverte)
  return aggravee ? apres : null
}
