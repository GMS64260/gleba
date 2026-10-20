/**
 * « À arroser aujourd'hui » : seule source des lignes d'arrosage des tâches,
 * du calendrier potager, des notifications et de l'accueil.
 *
 * Refonte du 2026-10-10. L'ancien plan d'arrosage pré-générait un passage
 * tous les 2, 3 ou 5 jours de la plantation à la fin de récolte, sans saison
 * ni pluie : 17 comptes réels, 3 283 passages, 5 % notés faits, des arrosages
 * prévus tous les deux jours en janvier. Le besoin se calcule désormais chaque
 * jour depuis le bilan hydrique (`computeConseilIrrigation` : pluie passée et
 * prévue, ET0, sol, besoin de l'espèce, dernier arrosage noté), pour les
 * seules cultures cochées « à irriguer ». Noter un
 * arrosage remet le compteur à zéro ; rien n'est dû d'avance, donc rien n'est
 * « en retard » ni « périmé ».
 */

import { computeConseilIrrigation } from '@/lib/irrigation-conseil'
import { contexteQuantiteVersee } from '@/lib/irrigation/quantite-versee'
import type { CultureHorsTournee } from '@/lib/irrigation/hors-tournee'

/** Urgences qui font une ligne « à arroser » ; « moyenne » et « faible » se surveillent. */
export const URGENCES_A_ARROSER = ['critique', 'haute'] as const
export type UrgenceAArroser = (typeof URGENCES_A_ARROSER)[number]

/** Sous-ensemble d'une culture du conseil, suffisant pour décider. */
export interface CultureConseil {
  id: number
  /**
   * Opt-in « à irriguer » : seule une culture cochée fait une ligne. Le
   * conseil montre aussi les espèces exigeantes non cochées (information),
   * mais l'outil propose sans imposer (revue du 2026-10-10 : une courgette
   * en goutte-à-goutte programmé, décochée, sortait quand même en tâche et
   * en courriel).
   */
  aIrriguer: boolean | null
  urgence: string
  raisonUrgence: string
  sousAbri: boolean
  espece: { nom: string | null } | null
  /** Variété (nom perso, sinon identifiant lisible du catalogue). */
  variete?: { id: string; nom: string | null } | null
  planche: {
    id: string
    nom: string | null
    ilot: string | null
    surface?: number | null
    largeur?: number | null
    longueur?: number | null
  } | null
  /** Conseil du bilan (null sans météo) : L/m² à verser, efficacité du système comprise. */
  reserve?: { litresParM2: number } | null
}

export interface ArrosageDuJour {
  /** Clé stable : `planche:<id>`, ou `culture:<id>` sans planche. */
  cle: string
  plancheRefId: string | null
  plancheNom: string | null
  ilot: string | null
  /** Cultures à noter ensemble (un passage arrose toute la planche). */
  cultureIds: number[]
  /** « Tomate + Basilic ». */
  especes: string
  /** La plus forte urgence de la planche. */
  urgence: UrgenceAArroser
  /** Raison de la culture la plus urgente (« Déficit de 18 mm, 4 j sans eau. »). */
  raison: string
  sousAbri: boolean
  /**
   * L/m² conseillés par la culture qui pilote la ligne (null sans météo),
   * et surface sur laquelle des litres notés se répartissent : la planche,
   * sinon la culture (0 si inconnue). Préremplissent « Quantité versée »,
   * comme sur le conseiller (ticket QA cmv3japsf).
   */
  litresParM2: number | null
  surfaceM2: number
}

const RANG: Record<UrgenceAArroser, number> = { critique: 0, haute: 1 }

function estAArroser(urgence: string): urgence is UrgenceAArroser {
  return (URGENCES_A_ARROSER as readonly string[]).includes(urgence)
}

/** Regroupe par planche les cultures dont l'urgence impose un arrosage. Pur. */
export function arrosagesDuJour(cultures: CultureConseil[]): ArrosageDuJour[] {
  const groupes = new Map<string, CultureConseil[]>()
  for (const c of cultures) {
    if (c.aIrriguer !== true || !estAArroser(c.urgence)) continue
    const cle = c.planche ? `planche:${c.planche.id}` : `culture:${c.id}`
    const groupe = groupes.get(cle) ?? []
    groupe.push(c)
    groupes.set(cle, groupe)
  }

  const lignes = Array.from(groupes.entries()).map(([cle, groupe]) => {
    // Même règle de pilote que le conseiller (`grouperRecommandationsParPlanche`) :
    // la plus forte urgence, puis la plus forte dose. Mais parmi les seules
    // cultures cochées « à irriguer » : le conseiller voit toute la planche,
    // et une culture décochée (goutte-à-goutte programmé) peut y piloter un
    // autre volume.
    const tete = [...groupe].sort(
      (a, b) =>
        RANG[a.urgence as UrgenceAArroser] - RANG[b.urgence as UrgenceAArroser] ||
        (b.reserve?.litresParM2 ?? 0) - (a.reserve?.litresParM2 ?? 0),
    )[0]
    const especes = Array.from(
      new Set(groupe.map((c) => c.espece?.nom).filter((n): n is string => Boolean(n))),
    ).join(' + ')
    // Même surface que le chargeur des arrosages saisis (`arrosages-saisis.ts`) ;
    // sans planche, inconnue (0) : l'arrosage compte comme complet. Règle
    // partagée avec la page Irriguer (`contexteQuantiteVersee`).
    const { litresParM2, surfaceM2 } = contexteQuantiteVersee(tete)
    return {
      cle,
      plancheRefId: tete.planche?.id ?? null,
      plancheNom: tete.planche?.nom ?? null,
      ilot: tete.planche?.ilot ?? null,
      cultureIds: Array.from(new Set(groupe.map((c) => c.id))),
      especes,
      urgence: tete.urgence as UrgenceAArroser,
      raison: tete.raisonUrgence,
      sousAbri: groupe.some((c) => c.sousAbri),
      litresParM2,
      surfaceM2,
    }
  })

  return lignes.sort(
    (a, b) =>
      RANG[a.urgence] - RANG[b.urgence] ||
      (a.ilot ?? '').localeCompare(b.ilot ?? '', 'fr') ||
      (a.plancheNom ?? '').localeCompare(b.plancheNom ?? '', 'fr', { numeric: true }),
  )
}

/** « Poireau Bleu de Solaise » : la variété la nomme souvent déjà avec l'espèce. */
function libelleCulture(c: CultureConseil): string {
  const espece = c.espece?.nom ?? ''
  const variete = c.variete ? (c.variete.nom ?? c.variete.id) : null
  if (!variete) return espece || `Culture #${c.id}`
  if (!espece || variete.toLocaleLowerCase('fr').includes(espece.toLocaleLowerCase('fr'))) return variete
  return `${espece} ${variete}`
}

/**
 * Cultures en urgence critique ou haute que l'opt-in « à irriguer » écarte de
 * la tournée. Elles ne font ni ligne ni courriel (décision du 2026-10-10),
 * mais on les nomme : un filtre qui écarte une ligne doit la dire (QA
 * cmvge3o5z). Revue du 2026-10-20 :
 * - jamais cochée (`null`) : invitation à la cocher ; décochée (`false`,
 *   goutte-à-goutte programmé par exemple) : exclusion volontaire, dite sans
 *   ton d'alerte (on propose sans imposer) ;
 * - une culture dont la planche est déjà dans la tournée n'en est pas
 *   écartée : le passage arrose toute la planche.
 * Pur.
 */
export function culturesHorsTournee(cultures: CultureConseil[]): CultureHorsTournee[] {
  const planchesDeLaTournee = new Set(
    cultures
      .filter((c) => c.aIrriguer === true && estAArroser(c.urgence) && c.planche)
      .map((c) => c.planche!.id),
  )
  return cultures
    .filter((c): c is CultureConseil & { urgence: UrgenceAArroser } => c.aIrriguer !== true && estAArroser(c.urgence))
    .filter((c) => !(c.planche && planchesDeLaTournee.has(c.planche.id)))
    .sort((a, b) => RANG[a.urgence] - RANG[b.urgence])
    .map((c) => ({
      cultureId: c.id,
      libelle: libelleCulture(c),
      plancheNom: c.planche?.nom ?? null,
      urgence: c.urgence,
      motif: c.aIrriguer === false ? ('exclue' as const) : ('non_cochee' as const),
    }))
}

/** La tournée du jour : ses lignes, et les cultures en urgence qu'elle écarte. */
export interface TourneeDuJour {
  lignes: ArrosageDuJour[]
  /** Cultures notées par la tournée (cochées, en urgence critique ou haute). */
  nbCultures: number
  horsTournee: CultureHorsTournee[]
}

const TOURNEE_VIDE: TourneeDuJour = { lignes: [], nbCultures: 0, horsTournee: [] }

/**
 * Seule règle de la tournée du jour, pour la page Tâches (et tous les lecteurs
 * de `chargerArrosagesDuJour`) comme pour la page Irriguer, qui comptait de son
 * côté toutes les urgences (QA cmvge3o5z). Le conseil ne vaut que pour la
 * saison en cours : une autre année n'a pas de tournée. Pur.
 */
export function tourneeDuJour(
  cultures: CultureConseil[],
  annee: number,
  maintenant: Date = new Date(),
): TourneeDuJour {
  if (annee !== maintenant.getFullYear()) return TOURNEE_VIDE
  const lignes = arrosagesDuJour(cultures)
  return {
    lignes,
    nbCultures: lignes.reduce((total, l) => total + l.cultureIds.length, 0),
    horsTournee: culturesHorsTournee(cultures),
  }
}

/** Tournée du jour d'un compte, en lecture seule. */
export async function chargerTourneeDuJour(userId: string, annee: number): Promise<TourneeDuJour> {
  if (annee !== new Date().getFullYear()) return TOURNEE_VIDE
  const conseil = await computeConseilIrrigation(userId, annee)
  return tourneeDuJour(conseil.data, annee)
}

/**
 * Lignes « à arroser » du jour d'un compte, en lecture seule. Le conseil ne
 * vaut que pour la saison en cours : une autre année ne rend rien.
 */
export async function chargerArrosagesDuJour(userId: string, annee: number): Promise<ArrosageDuJour[]> {
  return (await chargerTourneeDuJour(userId, annee)).lignes
}
