/**
 * Calendrier de semis — adaptation climatique et biodynamique.
 *
 * Le référentiel ITP donne des semaines de semis/plantation/récolte « moyennes »,
 * calées sur un climat de référence (océanique altéré : bassin parisien / Loire,
 * climat « moyen » des calendriers de semis nationaux français).
 *
 * Ce module décale ces semaines selon la zone climatique réelle de l'exploitation
 * (plus précoce au sud, plus tardif en altitude / à l'est), expose les dates
 * moyennes de gelées par zone, et catégorise les espèces pour le calendrier
 * lunaire (feuille / fruit / racine / fleur).
 *
 * Les valeurs sont volontairement SIMPLES (repères agronomiques à la semaine
 * près) : elles ne remplacent pas l'observation locale, mais recalent le
 * calendrier dans le bon ordre de grandeur. L'utilisateur peut affiner via le
 * curseur précoce/tardif de la page calendrier.
 */

import type { ZoneClimat } from './terroir'
import { ZONE_CLIMAT_LABEL } from './terroir'

export type CategorieLunaire = 'feuille' | 'fruit' | 'racine' | 'fleur'

/**
 * Zones d'outre-mer tropicales/équatoriales : leur calendrier ne se dérive PAS
 * du référentiel métropolitain par décalage (saisons humide/sèche, et surtout
 * inversion des saisons en hémisphère sud). Pour ces zones on s'appuie sur des
 * ITP dédiés (ITP.zoneClimat) ; à défaut, on affiche « pas de calendrier de
 * référence pour votre zone » plutôt qu'un décalage trompeur.
 */
export const ZONES_HORS_REFERENCE_METROPOLE: readonly ZoneClimat[] = [
  'tropical_antilles',
  'equatorial',
  'tropical_austral',
] as const

/** Zones de l'hémisphère SUD : saisons inversées vs métropole. */
export const ZONES_HEMISPHERE_SUD: readonly ZoneClimat[] = ['tropical_austral'] as const

/**
 * Vrai si le référentiel ITP métropolitain (et donc le décalage en semaines)
 * n'a pas de sens pour cette zone : il faut un ITP calé sur la zone.
 */
export function zoneHorsReferenceMetropole(zone: ZoneClimat | null | undefined): boolean {
  return zone != null && ZONES_HORS_REFERENCE_METROPOLE.includes(zone)
}

/** Vrai si la zone est dans l'hémisphère sud (saisons inversées). */
export function zoneHemisphereSud(zone: ZoneClimat | null | undefined): boolean {
  return zone != null && ZONES_HEMISPHERE_SUD.includes(zone)
}

/**
 * Un ITP est-il applicable à la zone de l'utilisateur ?
 * - Zone d'outre-mer (hors référence) → seuls les ITP calés sur CETTE zone
 *   (itpZoneClimat === userZone). Les ITP métropolitains ne sont pas
 *   transposables (semaines calendaires inadaptées, hémisphère éventuellement
 *   inversé).
 * - Zone métropolitaine ou indéterminée → seuls les ITP du référentiel
 *   métropolitain (itpZoneClimat null). Les ITP tropicaux dédiés sont masqués
 *   (leurs semaines ne veulent rien dire en métropole).
 */
export function itpApplicableAZone(
  itpZoneClimat: string | null | undefined,
  userZone: ZoneClimat | null | undefined
): boolean {
  if (zoneHorsReferenceMetropole(userZone)) {
    return itpZoneClimat === userZone
  }
  return itpZoneClimat == null
}

/**
 * Décalage des semis de plein air en semaines, par rapport à la zone de
 * référence (océanique altéré = 0). Positif = plus tardif (saison qui démarre
 * plus tard), négatif = plus précoce.
 *
 * Repères : un climat méditerranéen permet de semer ~2 semaines avant le bassin
 * parisien ; un climat montagnard impose ~3 semaines de retard (gelées tardives,
 * saison courte). Sources : calendriers de semis régionaux (GNIS / Kokopelli /
 * J.-M. Fortier adapté France).
 */
export const DECALAGE_ZONE: Record<ZoneClimat, number> = {
  mediterraneen: -2,
  oceanique: -1,
  oceanique_altere: 0,
  semi_continental: 1,
  montagnard: 3,
  // Outre-mer : le décalage vis-à-vis du référentiel métropolitain n'a pas de
  // sens (cf. zoneHorsReferenceMetropole). Valeur neutre 0 — jamais appliquée
  // en pratique car ces zones passent par des ITP dédiés.
  tropical_antilles: 0,
  equatorial: 0,
  tropical_austral: 0,
}

/**
 * Semaine ISO moyenne des DERNIÈRES gelées de printemps (« saints de glace »).
 * Au-delà de cette semaine, les cultures gélives peuvent passer en pleine terre.
 * `null` = pas de risque de gelée (climat tropical).
 */
export const SEMAINE_DERNIERES_GELEES: Record<ZoneClimat, number | null> = {
  mediterraneen: 9, // début mars
  oceanique: 13, // fin mars
  oceanique_altere: 15, // mi-avril
  semi_continental: 17, // fin avril / début mai
  montagnard: 22, // début juin
  // Outre-mer tropical : pas de gelée (le modèle « saints de glace » ne s'applique pas).
  tropical_antilles: null,
  equatorial: null,
  tropical_austral: null,
}

/**
 * Semaine ISO moyenne des PREMIÈRES gelées d'automne. En-deçà de cette semaine,
 * les cultures gélives doivent être récoltées ou protégées. `null` = pas de gel.
 */
export const SEMAINE_PREMIERES_GELEES: Record<ZoneClimat, number | null> = {
  mediterraneen: 49, // début décembre
  oceanique: 46, // mi-novembre
  oceanique_altere: 44, // début novembre
  semi_continental: 42, // mi-octobre
  montagnard: 39, // fin septembre
  // Outre-mer tropical : pas de gelée.
  tropical_antilles: null,
  equatorial: null,
  tropical_austral: null,
}

/** Décalage en semaines pour une zone (0 si zone inconnue). */
export function decalageZone(zone: ZoneClimat | null | undefined): number {
  if (!zone) return 0
  return DECALAGE_ZONE[zone] ?? 0
}

/**
 * Décale une semaine ISO (1-52) d'un nombre de semaines, en restant dans
 * l'intervalle [1, 52] (modulo l'année). Retourne null si la semaine source
 * est nulle.
 */
export function decalerSemaine(
  semaine: number | null | undefined,
  decalage: number
): number | null {
  if (semaine == null) return null
  let s = ((Math.round(semaine) + decalage - 1) % 52 + 52) % 52 + 1
  if (s < 1) s = 1
  if (s > 52) s = 52
  return s
}

export interface ItpSemaines {
  semaineSemis?: number | null
  semainePlantation?: number | null
  semaineRecolte?: number | null
}

/**
 * Applique un décalage (zone + réglage fin) aux semaines d'un ITP, sans toucher
 * aux autres champs. L'ITP de référence en base reste intact : on ne décale que
 * pour l'affichage.
 */
export function appliquerDecalageItp<T extends ItpSemaines>(itp: T, decalage: number): T {
  if (!decalage) return itp
  return {
    ...itp,
    semaineSemis: decalerSemaine(itp.semaineSemis, decalage),
    semainePlantation: decalerSemaine(itp.semainePlantation, decalage),
    semaineRecolte: decalerSemaine(itp.semaineRecolte, decalage),
  }
}

/** Libellé court d'un décalage (« +3 sem. », « −2 sem. », « à la référence »). */
export function libelleDecalage(decalage: number): string {
  if (decalage === 0) return 'calé sur la référence'
  const signe = decalage > 0 ? '+' : '−'
  const n = Math.abs(decalage)
  return `${signe}${n} sem. ${decalage > 0 ? '(plus tardif)' : '(plus précoce)'}`
}

export function labelZone(zone: ZoneClimat | null | undefined): string {
  if (!zone) return 'Non déterminée'
  return ZONE_CLIMAT_LABEL[zone] ?? zone
}

// ── Catégorisation lunaire (biodynamie) ───────────────────────────────────
//
// Le calendrier lunaire biodynamique classe chaque culture selon la PARTIE
// récoltée : feuille, fruit/graine, racine, ou fleur. On déduit cette catégorie
// d'abord du nom de l'espèce (le plus fiable, le référentiel est en français),
// puis de la famille botanique en repli.

/** Mots-clés (dans l'id/nom de l'espèce) → catégorie lunaire. Ordre = priorité. */
const MOTS_CLES_LUNAIRE: Array<{ re: RegExp; cat: CategorieLunaire }> = [
  // Fleurs / inflorescences récoltées
  { re: /brocoli|chou-fleur|chou fleur|artichaut|cosmos|tag[eè]te|capucine|fleur/i, cat: 'fleur' },
  // Racines / bulbes / tubercules
  {
    re: /carotte|radis|betterave|navet|panais|salsifis|raifort|cèleri[- ]?rave|c[eé]leri[- ]?rave|topinambour|pomme de terre|patate|oignon|[eé]chalote|\bail\b|poireau|fenouil|asperge|rutabaga|cresson de terre|crosne/i,
    cat: 'racine',
  },
  // Fruits / graines
  {
    re: /tomate|aubergine|poivron|piment|courge|courgette|potiron|potimarron|concombre|cornichon|melon|past[eè]que|haricot|\bpois\b|petit pois|f[eè]ve|ma[iï]s|chayote|physalis|fraise|framboise|groseille|cassis|baie|raisin|vigne|kiwi|pomme|poire|cerise|prune|p[eê]che|abricot|figue|noix|noisette|amande|ch[aâ]taigne|courge butternut/i,
    cat: 'fruit',
  },
  // Feuilles / tiges feuillues
  {
    re: /laitue|salade|chicor[eé]e|m[aâ]che|roquette|[eé]pinard|blette|bette|chou|chénopode|ch[eé]nopode|amarante|persil|basilic|coriandre|aneth|ciboulette|cerfeuil|menthe|sauge|thym|romarin|origan|estragon|aromat|herbe|c[eé]leri\b|c[eé]leri[- ]?branche|poir[eé]e/i,
    cat: 'feuille',
  },
]

/** Famille botanique → catégorie lunaire dominante (repli). */
const FAMILLE_LUNAIRE: Record<string, CategorieLunaire> = {
  Solanaceae: 'fruit',
  Cucurbitaceae: 'fruit',
  Fabaceae: 'fruit',
  Poaceae: 'fruit',
  Rosaceae: 'fruit',
  Vitaceae: 'fruit',
  Grossulariaceae: 'fruit',
  Actinidiaceae: 'fruit',
  Moraceae: 'fruit',
  Ebenaceae: 'fruit',
  Juglandaceae: 'fruit',
  Apiaceae: 'racine',
  Alliaceae: 'racine',
  Amaryllidaceae: 'racine',
  Asparagaceae: 'racine',
  Convolvulaceae: 'racine',
  Asteraceae: 'feuille', // salades, chicorées (le brocoli/artichaut sont rattrapés par mots-clés)
  Lamiaceae: 'feuille',
  Valerianaceae: 'feuille',
  Amaranthaceae: 'feuille', // épinard/blette ; betterave rattrapée par mots-clés
  Brassicaceae: 'feuille', // choux ; radis/navet/brocoli rattrapés par mots-clés
}

/**
 * Catégorie lunaire d'une espèce : feuille / fruit / racine / fleur.
 * Heuristique indicative (nom puis famille). Retourne null si indéterminable.
 */
export function categorieLunaire(opts: {
  especeId?: string | null
  nom?: string | null
  famille?: string | null
}): CategorieLunaire | null {
  const nom = opts.nom || opts.especeId || ''
  for (const { re, cat } of MOTS_CLES_LUNAIRE) {
    if (re.test(nom)) return cat
  }
  if (opts.famille && FAMILLE_LUNAIRE[opts.famille]) return FAMILLE_LUNAIRE[opts.famille]
  return null
}

export const CATEGORIE_LUNAIRE_LABEL: Record<CategorieLunaire, { label: string; emoji: string }> = {
  feuille: { label: 'Feuille', emoji: '🍃' },
  fruit: { label: 'Fruit', emoji: '🍅' },
  racine: { label: 'Racine', emoji: '🥕' },
  fleur: { label: 'Fleur', emoji: '🌸' },
}
