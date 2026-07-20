/**
 * « Plan vivant » : taille des éléments du plan 2D à une date donnée.
 *
 * Les cultures grandissent de la plantation à la maturité (dates réelles de
 * la culture, durées de l'ITP en repli), puis libèrent la planche après la
 * récolte. Les arbres croissent de l'envergure mesurée aujourd'hui vers leur
 * couronne adulte (envergureAdulte de l'arbre, sinon étalement de l'espèce).
 *
 * Toutes les fonctions sont pures : utilisées par l'éditeur ET testées.
 */

const JOUR_MS = 24 * 3600 * 1000
const AN_MS = 365.25 * JOUR_MS

/** Durée de croissance par défaut quand l'ITP ne la donne pas (jours). */
const DUREE_CULTURE_DEFAUT = 90
/** Durée de récolte par défaut après maturité (semaines). */
const DUREE_RECOLTE_DEFAUT_SEMAINES = 6
/** Taille relative minimale d'un jeune plant (reste visible dès la plantation). */
const CROISSANCE_MIN = 0.12
/** Années pour qu'un arbre nouvellement planté atteigne sa couronne adulte. */
const ANNEES_CROISSANCE_ARBRE = 10
/** Envergure supposée d'un arbre à la plantation (m). */
const ENVERGURE_PLANTATION = 0.6

export interface CultureCroissanceInput {
  dateSemis: string | Date | null
  datePlantation: string | Date | null
  dateRecolte: string | Date | null
  finRecolte: string | Date | null
  itp?: { dureeCulture: number | null; dureeRecolte: number | null } | null
}

export interface ArbreCroissanceInput {
  envergure: number
  envergureAdulte?: number | null
  especeEtalement?: number | null
  datePlantation?: string | Date | null
}

function asDate(d: string | Date | null | undefined): Date | null {
  if (!d) return null
  const date = d instanceof Date ? d : new Date(d)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Fraction de croissance [CROISSANCE_MIN..1] d'une culture à une date donnée,
 * ou null si la culture n'occupe pas la planche à cette date (avant la mise
 * en place, ou après la fin de récolte). Sans aucune date connue, la culture
 * est considérée en place à taille adulte (vivaces, imports).
 */
export function croissanceCulture(c: CultureCroissanceInput, date: Date): number | null {
  const debut = asDate(c.datePlantation) ?? asDate(c.dateSemis)
  if (!debut) return 1
  if (date < debut) return null

  const recolte = asDate(c.dateRecolte)
  const maturite =
    recolte && recolte > debut
      ? recolte
      : new Date(debut.getTime() + (c.itp?.dureeCulture ?? DUREE_CULTURE_DEFAUT) * JOUR_MS)

  const finExplicite = asDate(c.finRecolte)
  const fin =
    finExplicite && finExplicite > debut
      ? finExplicite
      : new Date(
          maturite.getTime() +
            (c.itp?.dureeRecolte ?? DUREE_RECOLTE_DEFAUT_SEMAINES) * 7 * JOUR_MS
        )

  if (date > fin) return null
  if (date >= maturite) return 1

  const f = (date.getTime() - debut.getTime()) / (maturite.getTime() - debut.getTime())
  return Math.max(CROISSANCE_MIN, Math.min(1, f))
}

/**
 * Envergure dessinée d'un arbre (m) à une date donnée.
 *
 * - À la date du jour : l'envergure mesurée, telle quelle.
 * - Dans le futur : croissance linéaire résiduelle vers la couronne adulte,
 *   calée sur l'âge de l'arbre (un jeune arbre a plus d'années de croissance
 *   devant lui qu'un arbre déjà établi).
 * - Dans le passé : interpolation entre l'envergure de plantation et la
 *   mesure actuelle ; avant la plantation, 0 (absent du plan).
 */
export function envergureArbreADate(
  arbre: ArbreCroissanceInput,
  date: Date,
  aujourdHui: Date = new Date()
): number {
  const adulte = arbre.envergureAdulte ?? arbre.especeEtalement ?? null
  const plantation = asDate(arbre.datePlantation)
  const dAnnees = (date.getTime() - aujourdHui.getTime()) / AN_MS

  if (dAnnees > 0) {
    if (!adulte || adulte <= arbre.envergure) return arbre.envergure
    const ageActuel = plantation
      ? Math.max(0, (aujourdHui.getTime() - plantation.getTime()) / AN_MS)
      : ANNEES_CROISSANCE_ARBRE / 2
    const anneesRestantes = Math.max(1, ANNEES_CROISSANCE_ARBRE - ageActuel)
    const f = Math.min(1, dAnnees / anneesRestantes)
    return arbre.envergure + (adulte - arbre.envergure) * f
  }

  if (!plantation) return arbre.envergure
  if (date < plantation) return 0
  const total = aujourdHui.getTime() - plantation.getTime()
  if (total <= 0) return arbre.envergure
  const f = Math.max(0, Math.min(1, (date.getTime() - plantation.getTime()) / total))
  const initiale = Math.min(ENVERGURE_PLANTATION, arbre.envergure)
  return initiale + (arbre.envergure - initiale) * f
}
