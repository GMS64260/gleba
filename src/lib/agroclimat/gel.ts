/**
 * Gel d'une parcelle : dernière gelée de printemps, première gelée d'automne et
 * leur fréquence, mesurées sur les minimums quotidiens des années passées.
 *
 * Remplace, quand l'historique existe, les dates de gel fixées par zone
 * climatique (`src/lib/calendrier-climat.ts`) par ce qui s'est réellement passé
 * à cet endroit. Les minimums sont ceux de l'air sous abri à 2 m : au ras du
 * sol, par nuit claire, il fait 1 à 3 °C de moins, d'où le second seuil.
 *
 * Fonctions pures : aucune lecture de base ni d'horloge.
 */

import { CASES_ANNEE, caseDuJour, caseInexistante } from "./calendrier"

/** Minimums quotidiens d'une année, rangés sur 366 cases (`calendrier.ts`). */
export interface AnneeTmin {
  annee: number
  tmin: readonly (number | null)[]
}

/** Seuils sous abri, en °C. */
export const SEUIL_GELEE = 0
export const SEUIL_FORTE_GELEE = -2

/** Le printemps va du 1er janvier au 31 juillet, l'automne du 1er août au 31 décembre. */
const DEBUT_AUTOMNE = caseDuJour(8, 1)
/** Jours manquants tolérés dans une demi-année avant de l'écarter. */
const TROUS_TOLERES = 5
/** Années retenues pour les statistiques : la normale climatique de 30 ans. */
export const ANNEES_NORMALE = 30

export interface GelAnnee {
  annee: number
  /** Case de la dernière gelée de printemps ; `null` si aucune ; `undefined` si la demi-année est incomplète. */
  derniereGelee: number | null | undefined
  /** Case de la première gelée d'automne, mêmes conventions. */
  premiereGelee: number | null | undefined
  /** Jours de gel de l'année civile ; `undefined` si l'année est incomplète. */
  joursDeGel: number | undefined
}

function demiAnnee(
  annee: AnneeTmin,
  debut: number,
  fin: number,
  seuil: number
): { complete: boolean; premiere: number | null; derniere: number | null; jours: number } {
  let trous = 0
  let premiere: number | null = null
  let derniere: number | null = null
  let jours = 0
  for (let i = debut; i < fin; i++) {
    const t = annee.tmin[i]
    if (t == null) {
      if (!caseInexistante(annee.annee, i)) trous++
      continue
    }
    if (t <= seuil) {
      if (premiere === null) premiere = i
      derniere = i
      jours++
    }
  }
  return { complete: trous <= TROUS_TOLERES, premiere, derniere, jours }
}

/** Gel de chaque année, au seuil donné. */
export function gelParAnnee(annees: readonly AnneeTmin[], seuil: number = SEUIL_GELEE): GelAnnee[] {
  return [...annees]
    .sort((a, b) => a.annee - b.annee)
    .map((annee) => {
      const printemps = demiAnnee(annee, 0, DEBUT_AUTOMNE, seuil)
      const automne = demiAnnee(annee, DEBUT_AUTOMNE, CASES_ANNEE, seuil)
      return {
        annee: annee.annee,
        derniereGelee: printemps.complete ? printemps.derniere : undefined,
        premiereGelee: automne.complete ? automne.premiere : undefined,
        joursDeGel: printemps.complete && automne.complete ? printemps.jours + automne.jours : undefined,
      }
    })
}

/**
 * Valeur de rang `p` (0 à 1) d'une liste triée, méthode du rang le plus proche :
 * au moins `p` des valeurs lui sont inférieures ou égales.
 */
function rang<T>(triees: readonly T[], p: number): T {
  return triees[Math.min(triees.length - 1, Math.max(0, Math.ceil(p * triees.length) - 1))]
}

function mediane(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) return null
  const triees = [...valeurs].sort((a, b) => a - b)
  const milieu = Math.floor(triees.length / 2)
  return triees.length % 2 === 1 ? triees[milieu] : Math.round((triees[milieu - 1] + triees[milieu]) / 2)
}

export interface RepereGel {
  /** Années prises en compte. */
  annees: number
  /** Années sans aucune gelée sur la période. */
  anneesSansGel: number
  /** Case de la date médiane : une année sur deux, la gelée tombe avant ; `null` si une année sur deux ne gèle pas. */
  mediane: number | null
  /**
   * Case de la date de prudence : au printemps, il n'a gelé après cette date
   * qu'une année sur dix au plus ; à l'automne, avant cette date. `null` si le
   * gel est trop rare pour la situer.
   */
  prudence: number | null
  /** Gelée la plus extrême de la période (la plus tardive au printemps, la plus précoce à l'automne). */
  extreme: { annee: number; case: number } | null
}

function repere(observations: readonly { annee: number; case: number | null }[], sens: "printemps" | "automne"): RepereGel {
  const n = observations.length
  // Une année sans gel se range avant toutes les autres au printemps (elle ne
  // repousse aucune date), après toutes les autres à l'automne.
  const absent = sens === "printemps" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
  const triees = observations.map((o) => o.case ?? absent).sort((a, b) => a - b)
  const fini = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v : null)
  const avecGel = observations.filter((o): o is { annee: number; case: number } => o.case !== null)
  const extreme =
    avecGel.length === 0
      ? null
      : avecGel.reduce((a, b) => (sens === "printemps" ? (b.case > a.case ? b : a) : b.case < a.case ? b : a))
  return {
    annees: n,
    anneesSansGel: n - avecGel.length,
    mediane: n === 0 ? null : fini(rang(triees, 0.5)),
    prudence: n === 0 ? null : fini(rang(triees, sens === "printemps" ? 0.9 : 0.1)),
    extreme: extreme ? { annee: extreme.annee, case: extreme.case } : null,
  }
}

export interface TendanceGel {
  /** Écart en jours de la médiane récente à la médiane ancienne (négatif = plus tôt). */
  ecartJours: number
  anneesRecentes: number
  anneesAnciennes: number
}

export interface StatistiquesGel {
  seuil: number
  /** Première et dernière année prises en compte. */
  periode: { debut: number; fin: number } | null
  printemps: RepereGel
  automne: RepereGel
  /** Jours de gel par an, en moyenne ; `null` sans année complète. */
  joursDeGelParAn: number | null
  /** Jours entre la dernière gelée de printemps et la première d'automne, en médiane. */
  saisonSansGelJours: number | null
  /** Évolution de la dernière gelée de printemps, moitié récente contre moitié ancienne. */
  tendancePrintemps: TendanceGel | null
}

/** Années minimales de chaque moitié pour oser une tendance. */
const ANNEES_MIN_TENDANCE = 10

/**
 * Statistiques de gel sur les `ANNEES_NORMALE` dernières années exploitables.
 * L'année en cours n'y entre que pour les demi-années déjà écoulées et
 * complètes (c'est l'appelant qui ne fournit pas de jours futurs).
 */
export function statistiquesGel(annees: readonly AnneeTmin[], seuil: number = SEUIL_GELEE): StatistiquesGel {
  const parAnnee = gelParAnnee(annees, seuil)
  const printemps = parAnnee
    .filter((a) => a.derniereGelee !== undefined)
    .slice(-ANNEES_NORMALE)
    .map((a) => ({ annee: a.annee, case: a.derniereGelee as number | null }))
  const automne = parAnnee
    .filter((a) => a.premiereGelee !== undefined)
    .slice(-ANNEES_NORMALE)
    .map((a) => ({ annee: a.annee, case: a.premiereGelee as number | null }))
  const completes = parAnnee.filter((a) => a.joursDeGel !== undefined).slice(-ANNEES_NORMALE)

  const toutes = [...printemps, ...automne].map((a) => a.annee)
  const saisons = completes
    .filter((a) => a.derniereGelee != null && a.premiereGelee != null)
    .map((a) => (a.premiereGelee as number) - (a.derniereGelee as number) - 1)

  let tendancePrintemps: TendanceGel | null = null
  const moitie = Math.floor(printemps.length / 2)
  const anciennes = printemps.slice(0, moitie).flatMap((a) => (a.case === null ? [] : [a.case]))
  const recentes = printemps.slice(moitie).flatMap((a) => (a.case === null ? [] : [a.case]))
  if (anciennes.length >= ANNEES_MIN_TENDANCE && recentes.length >= ANNEES_MIN_TENDANCE) {
    tendancePrintemps = {
      ecartJours: (mediane(recentes) as number) - (mediane(anciennes) as number),
      anneesRecentes: recentes.length,
      anneesAnciennes: anciennes.length,
    }
  }

  return {
    seuil,
    periode: toutes.length === 0 ? null : { debut: Math.min(...toutes), fin: Math.max(...toutes) },
    printemps: repere(printemps, "printemps"),
    automne: repere(automne, "automne"),
    joursDeGelParAn:
      completes.length === 0
        ? null
        : Math.round((completes.reduce((s, a) => s + (a.joursDeGel as number), 0) / completes.length) * 10) / 10,
    saisonSansGelJours: mediane(saisons),
    tendancePrintemps,
  }
}

export interface FrequenceGel {
  /** Années prises en compte. */
  annees: number
  /** Années où il a gelé du mauvais côté de la date. */
  anneesAvecGel: number
}

/**
 * Sur les années de la normale, combien de fois il a gelé à la date donnée ou
 * après (jusqu'au 31 juillet). Répond à « si je plante le 25 avril, quel
 * risque ? ».
 */
export function frequenceGelDepuis(
  annees: readonly AnneeTmin[],
  caseDate: number,
  seuil: number = SEUIL_GELEE
): FrequenceGel {
  const observations = gelParAnnee(annees, seuil)
    .filter((a) => a.derniereGelee !== undefined)
    .slice(-ANNEES_NORMALE)
  return {
    annees: observations.length,
    anneesAvecGel: observations.filter((a) => a.derniereGelee != null && a.derniereGelee >= caseDate).length,
  }
}

/**
 * Sur les années de la normale, combien de fois il a gelé à la date donnée ou
 * avant (depuis le 1er août). Répond à « ma culture tient-elle jusqu'au
 * 20 octobre ? ».
 */
export function frequenceGelJusqua(
  annees: readonly AnneeTmin[],
  caseDate: number,
  seuil: number = SEUIL_GELEE
): FrequenceGel {
  const observations = gelParAnnee(annees, seuil)
    .filter((a) => a.premiereGelee !== undefined)
    .slice(-ANNEES_NORMALE)
  return {
    annees: observations.length,
    anneesAvecGel: observations.filter((a) => a.premiereGelee != null && a.premiereGelee <= caseDate).length,
  }
}
