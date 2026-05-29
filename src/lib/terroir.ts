/**
 * Terroir — dérivation de la zone climatique et du contexte pédoclimatique d'un
 * utilisateur, pour le référentiel communautaire (ventilation des avis variété
 * « Selon le terroir »).
 *
 * Le climat n'est pas stocké tel quel : on le dérive du code postal (département)
 * de l'exploitation, ou à défaut des coordonnées d'une parcelle. La classification
 * est volontairement SIMPLIFIÉE (6 grandes zones) — c'est un repère agronomique,
 * pas une cartographie fine (l'altitude, les microclimats, etc. ne sont pas pris
 * en compte).
 */

import type { PrismaClient } from '@prisma/client'

export const ZONES_CLIMAT = [
  'oceanique',
  'oceanique_altere',
  'semi_continental',
  'montagnard',
  'mediterraneen',
  'tropical',
] as const

export type ZoneClimat = (typeof ZONES_CLIMAT)[number]

export const ZONE_CLIMAT_LABEL: Record<ZoneClimat, string> = {
  oceanique: 'Océanique',
  oceanique_altere: 'Océanique altéré',
  semi_continental: 'Semi-continental',
  montagnard: 'Montagnard',
  mediterraneen: 'Méditerranéen',
  tropical: 'Tropical',
}

/**
 * Mapping département (métropole) → zone climatique. Classification pragmatique
 * inspirée des grands types de climats français ; les départements à cheval sur
 * plusieurs influences sont rattachés à leur tendance dominante.
 */
const DEPT_ZONE: Record<string, ZoneClimat> = {
  '01': 'semi_continental', '02': 'oceanique_altere', '03': 'oceanique_altere',
  '04': 'montagnard', '05': 'montagnard', '06': 'mediterraneen',
  '07': 'mediterraneen', '08': 'semi_continental', '09': 'montagnard',
  '10': 'semi_continental', '11': 'mediterraneen', '12': 'montagnard',
  '13': 'mediterraneen', '14': 'oceanique', '15': 'montagnard',
  '16': 'oceanique_altere', '17': 'oceanique', '18': 'oceanique_altere',
  '19': 'oceanique_altere', '21': 'semi_continental', '22': 'oceanique',
  '23': 'oceanique_altere', '24': 'oceanique_altere', '25': 'semi_continental',
  '26': 'mediterraneen', '27': 'oceanique_altere', '28': 'oceanique_altere',
  '29': 'oceanique', '30': 'mediterraneen', '31': 'oceanique_altere',
  '32': 'oceanique_altere', '33': 'oceanique', '34': 'mediterraneen',
  '35': 'oceanique', '36': 'oceanique_altere', '37': 'oceanique_altere',
  '38': 'montagnard', '39': 'semi_continental', '40': 'oceanique',
  '41': 'oceanique_altere', '42': 'semi_continental', '43': 'montagnard',
  '44': 'oceanique', '45': 'oceanique_altere', '46': 'oceanique_altere',
  '47': 'oceanique_altere', '48': 'montagnard', '49': 'oceanique_altere',
  '50': 'oceanique', '51': 'semi_continental', '52': 'semi_continental',
  '53': 'oceanique_altere', '54': 'semi_continental', '55': 'semi_continental',
  '56': 'oceanique', '57': 'semi_continental', '58': 'semi_continental',
  '59': 'oceanique', '60': 'oceanique_altere', '61': 'oceanique_altere',
  '62': 'oceanique', '63': 'montagnard', '64': 'oceanique',
  '65': 'montagnard', '66': 'mediterraneen', '67': 'semi_continental',
  '68': 'semi_continental', '69': 'semi_continental', '70': 'semi_continental',
  '71': 'semi_continental', '72': 'oceanique_altere', '73': 'montagnard',
  '74': 'montagnard', '75': 'oceanique_altere', '76': 'oceanique',
  '77': 'oceanique_altere', '78': 'oceanique_altere', '79': 'oceanique_altere',
  '80': 'oceanique', '81': 'oceanique_altere', '82': 'oceanique_altere',
  '83': 'mediterraneen', '84': 'mediterraneen', '85': 'oceanique',
  '86': 'oceanique_altere', '87': 'oceanique_altere', '88': 'montagnard',
  '89': 'semi_continental', '90': 'semi_continental', '91': 'oceanique_altere',
  '92': 'oceanique_altere', '93': 'oceanique_altere', '94': 'oceanique_altere',
  '95': 'oceanique_altere',
}

/**
 * Zone climatique depuis un code postal français.
 * - 20xxx (Corse) → méditerranéen
 * - 97xxx / 98xxx (DROM-COM) → tropical
 * - sinon : département (2 premiers chiffres) → table
 */
export function zoneClimatiqueDepuisCodePostal(codePostal?: string | null): ZoneClimat | null {
  if (!codePostal) return null
  const cp = codePostal.trim()
  if (!/^\d{2}/.test(cp)) return null
  if (cp.startsWith('97') || cp.startsWith('98')) return 'tropical'
  if (cp.startsWith('20')) return 'mediterraneen' // Corse (2A/2B)
  return DEPT_ZONE[cp.slice(0, 2)] ?? null
}

/**
 * Fallback grossier par coordonnées (métropole) quand aucun code postal n'est
 * disponible. Approximation volontairement simple ; ne détecte pas le montagnard
 * (besoin de l'altitude).
 */
export function zoneClimatiqueDepuisLatLng(lat?: number | null, lng?: number | null): ZoneClimat | null {
  if (lat == null || lng == null) return null
  // Pourtour méditerranéen + Corse
  if (lat <= 44 && lng >= 3) return 'mediterraneen'
  // Façade est (Alsace, Bourgogne-Franche-Comté, Rhône)
  if (lng >= 5) return 'semi_continental'
  // Grand Ouest atlantique
  if (lng <= 0) return 'oceanique'
  return 'oceanique_altere'
}

export function zoneClimatique(opts: {
  codePostal?: string | null
  lat?: number | null
  lng?: number | null
}): ZoneClimat | null {
  return (
    zoneClimatiqueDepuisCodePostal(opts.codePostal) ??
    zoneClimatiqueDepuisLatLng(opts.lat, opts.lng)
  )
}

/** Valeur la plus fréquente d'une liste (null si liste vide). */
function valeurDominante(valeurs: (string | null | undefined)[]): string | null {
  const compte = new Map<string, number>()
  for (const v of valeurs) {
    if (!v) continue
    compte.set(v, (compte.get(v) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [v, n] of compte) {
    if (n > bestN) {
      best = v
      bestN = n
    }
  }
  return best
}

export interface TerroirUser {
  typeSol: string | null
  zoneClimat: ZoneClimat | null
  codePostal: string | null
}

/**
 * Reconstitue le terroir d'un utilisateur au moment d'un avis :
 * - typeSol  : valeur dominante de ses planches (puis parcelles) ;
 * - codePostal : depuis son exploitation ;
 * - zoneClimat : dérivée du code postal, à défaut du centroïde d'une parcelle.
 * Tout champ peut être null (« non précisé »).
 */
export async function terroirDeUser(prisma: PrismaClient, userId: string): Promise<TerroirUser> {
  const [exploitation, planches, parcelles] = await Promise.all([
    prisma.exploitation.findUnique({
      where: { userId },
      select: { codePostal: true },
    }),
    prisma.planche.findMany({
      where: { userId, typeSol: { not: null } },
      select: { typeSol: true },
    }),
    prisma.parcelleGeo.findMany({
      where: { userId },
      select: { typeSol: true, centroidLat: true, centroidLng: true },
    }),
  ])

  const typeSol = valeurDominante([
    ...planches.map((p) => p.typeSol),
    ...parcelles.map((p) => p.typeSol),
  ])

  const codePostal = exploitation?.codePostal ?? null
  const centroid = parcelles.find((p) => p.centroidLat != null && p.centroidLng != null)
  const zoneClimat = zoneClimatique({
    codePostal,
    lat: centroid?.centroidLat ?? null,
    lng: centroid?.centroidLng ?? null,
  })

  return { typeSol, zoneClimat, codePostal }
}
