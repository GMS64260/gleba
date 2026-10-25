/**
 * Nombre de plants d'une culture : UNE règle pour tous les écrans et toutes
 * les écritures (assistant « Semer », formulaires de création et d'édition,
 * dialogue du plan, « Créer les cultures », Planification > Plants, routes).
 *
 * Ticket QA cmvnpkkhp (2026-10-25) — l'assistant « Semer » affichait
 * « 3 rangs x 16m (30cm esp.) = ~159 plants » mais n'envoyait pas la quantité :
 * la culture naissait avec `quantite` vide (liste « — », champ vide à la
 * réouverture) quand Planification > Plants recalculait 159 depuis les
 * paramètres conservés. La formule existait en cinq copies, sur deux
 * arithmétiques qui ne tombent pas toujours sur le même entier :
 * `longueur ÷ (espacement ÷ 100)` (assistant) et `(longueur × 100) ÷ espacement`
 * (formulaires, planification). 0,30 m à 10 cm donnait 2 d'un côté, 3 de
 * l'autre ; et la seconde se trompe elle-même par arrondi flottant
 * (2,30 m à 10 cm : 22 au lieu de 23).
 *
 * Règle : plants par rang = ⌊longueur (cm) ÷ espacement sur le rang (cm)⌋, on
 * ne compte pas de fraction de plant ; multiplié par le nombre de rangs.
 * 16 m à 30 cm : ⌊53,33⌋ = 53 plants par rang, × 3 rangs = 159. Le calcul
 * « 3 × 16 ÷ 0,30 = 160 » additionnerait trois tiers de plant.
 */

/**
 * Tolérance de l'arrondi inférieur : `2.3 * 100 / 10` vaut 22,999999999999996
 * en virgule flottante. Vérifié sans écart contre le calcul entier exact
 * jusqu'à 200 m au millimètre, pour des espacements de 1 à 150 cm.
 */
const TOLERANCE_PLANCHER = 1e-9

const positif = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0

/**
 * Plants d'une culture depuis sa longueur (m), son nombre de rangs et son
 * espacement sur le rang (cm). `null` quand une donnée manque : « calcul
 * impossible » ne se confond pas avec « 0 plant ».
 */
export function nbPlantsCulture(
  longueur: number | null | undefined,
  nbRangs: number | null | undefined,
  espacement: number | null | undefined,
): number | null {
  if (!positif(longueur) || !positif(nbRangs) || !positif(espacement)) return null
  const plantsParRang = Math.floor((longueur * 100) / espacement + TOLERANCE_PLANCHER)
  return plantsParRang * nbRangs
}

type ParametresPlants = {
  longueur?: number | null
  nbRangs?: number | null
  espacement?: number | null
}

/** Quantité déduite des paramètres, si elle vaut au moins un plant. */
function quantiteDeduite(p: ParametresPlants): number | null {
  const n = nbPlantsCulture(p.longueur, p.nbRangs, p.espacement)
  return n != null && n > 0 ? n : null
}

/**
 * Une quantité de 0 plant vaut absence : les formulaires envoient 0 quand la
 * longueur ne loge aucun plant, la planification la lit déjà comme absente
 * (`mesurerCulture`), et tous les chemins stockent ainsi la même chose (null).
 */
const quantiteSaisie = (q: number | null | undefined): q is number => q != null && q > 0

/**
 * Quantité à écrire à la CRÉATION d'une culture : celle que le client envoie,
 * sinon celle que rangs, longueur et espacement permettent de calculer, sinon
 * rien. Appelée par `POST /api/cultures` et par les outils `create_culture` /
 * `create_cultures` de l'assistant : un client qui omet la quantité (assistant
 * « Semer » jusqu'au 2026-10-25) obtient la même valeur que le formulaire qui
 * l'envoie. L'import (`/api/import`) n'y passe pas : il restaure un export tel
 * quel, `quantite` comprise.
 */
export function quantiteCultureACreer(
  saisie: ParametresPlants & { quantite?: number | null },
): number | null {
  if (quantiteSaisie(saisie.quantite)) return saisie.quantite
  return quantiteDeduite(saisie)
}

/**
 * Quantité à écrire à la MODIFICATION d'une culture, ou `undefined` pour ne
 * pas y toucher. Le champ « Quantité / plants (auto) » du formulaire suit les
 * paramètres ; une valeur saisie à la main fait foi.
 *
 * - quantité envoyée non vide : elle fait foi (`undefined`, la route écrit ce
 *   qu'elle a reçu) ;
 * - quantité envoyée vide ou nulle (0) : déduite des paramètres finaux s'ils
 *   le permettent (le formulaire d'édition renvoyait vide une culture née sans
 *   quantité), sinon null ;
 * - quantité absente du corps et paramètres modifiés : recalculée si la
 *   quantité stockée était absente ou valait le calcul des anciens paramètres
 *   (mode « auto ») ; une quantité saisie à la main est conservée ;
 * - ni quantité ni paramètre dans le corps : rien ne change.
 */
export function quantiteCultureApresModification(
  existante: ParametresPlants & { quantite: number | null },
  modification: ParametresPlants & { quantite?: number | null },
): number | null | undefined {
  const finale: ParametresPlants = {
    longueur: modification.longueur !== undefined ? modification.longueur : existante.longueur,
    nbRangs: modification.nbRangs !== undefined ? modification.nbRangs : existante.nbRangs,
    espacement: modification.espacement !== undefined ? modification.espacement : existante.espacement,
  }

  if (modification.quantite !== undefined) {
    if (quantiteSaisie(modification.quantite)) return undefined
    return quantiteDeduite(finale)
  }

  const parametresModifies =
    modification.longueur !== undefined ||
    modification.nbRangs !== undefined ||
    modification.espacement !== undefined
  if (!parametresModifies) return undefined

  const etaitAuto =
    !quantiteSaisie(existante.quantite) ||
    existante.quantite === nbPlantsCulture(existante.longueur, existante.nbRangs, existante.espacement)
  if (!etaitAuto) return undefined

  const recalculee = quantiteDeduite(finale)
  return recalculee === existante.quantite ? undefined : recalculee
}
