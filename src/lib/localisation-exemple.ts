/**
 * Parcelle d'exemple de l'inscription, et détection des comptes qui l'ont
 * adoptée sans jamais la recaler.
 *
 * À l'inscription, Gleba crée une parcelle « Potager » géolocalisée EN DUR à
 * Paris 4ᵉ (`user-sample-data.ts`). Elle sert de décor de démonstration, mais
 * rien ne signale qu'il faut la déplacer : le 2026-08-14, 79 comptes étaient
 * encore dessus, dont un maraîcher quotidien qui y avait accroché 11 planches
 * et 23 cultures réelles.
 *
 * Or ces coordonnées pilotent tout le reste : météo et ET0 Open-Meteo,
 * prévision de pluie qui annule un arrosage, éphémérides, et les piézomètres
 * Hub'Eau — dont les dix stations parisiennes les plus proches n'ont plus un
 * relevé valide depuis 1930-1992, si bien que le bloc nappe disparaît sans
 * explication après dix appels HTTP inutiles.
 *
 * Tant qu'un compte s'en tient au décor livré, le silence est acceptable.
 * Dès qu'il DÉPASSE l'exemple, la localisation devient une donnée agronomique
 * fausse : on le lui dit.
 *
 * MISE À JOUR 2026-08-17 (refonte de l'onboarding) : le décor n'est plus créé
 * d'office au signup, et quand il l'est en fin de parcours il est ancré sur la
 * commune RÉELLE de l'utilisateur. Une parcelle encore sur le centroïde de
 * Paris ne peut donc plus être qu'un héritage (compte antérieur, ou création
 * par le chemin admin). Le silence a perdu sa raison d'être : `surDecorExemple`
 * signale la présence du décor pour tous ces comptes, `aRecaler` conservant
 * son rôle de « ce compte a bâti du réel dessus » pour l'insistance du message.
 */

import prisma from '@/lib/prisma'

/** Parcelle créée à l'inscription. Source unique : `user-sample-data.ts`. */
export const PARCELLE_EXEMPLE = {
  nom: 'Potager',
  geometry:
    '{"type":"Polygon","coordinates":[[[2.3510,48.8560],[2.3530,48.8560],[2.3530,48.8575],[2.3510,48.8575],[2.3510,48.8560]]]}',
  centroidLat: 48.85675,
  centroidLng: 2.3520,
  surface: 0.05,
  usage: 'culture, verger',
  couleur: '#4ade80',
  notes: 'Parcelle maraîchage',
} as const

/** Volumes livrés avec l'exemple : au-delà, le compte a saisi du réel. */
export const PLANCHES_EXEMPLE = 2
export const CULTURES_EXEMPLE = 4

/**
 * Tolérance de comparaison des coordonnées, en degrés (~11 m).
 * Une parcelle dessinée à la main ne retombe pas dessus par hasard ; une
 * parcelle jamais touchée, si.
 */
const EPSILON_DEGRES = 1e-4

export function estCentroidExemple(
  lat: number | null | undefined,
  lng: number | null | undefined
): boolean {
  if (lat == null || lng == null) return false
  return (
    Math.abs(lat - PARCELLE_EXEMPLE.centroidLat) < EPSILON_DEGRES &&
    Math.abs(lng - PARCELLE_EXEMPLE.centroidLng) < EPSILON_DEGRES
  )
}

export interface LocalisationARecaler {
  /** Vrai seulement si le compte a dépassé le décor d'exemple. */
  aRecaler: boolean
  /** Vrai dès qu'une parcelle est restée sur le centroïde d'exemple (Paris 4ᵉ). */
  surDecorExemple: boolean
  parcelleId: string | null
  parcelleNom: string | null
  nbPlanches: number
  nbCultures: number
}

const RIEN_A_SIGNALER: LocalisationARecaler = {
  aRecaler: false,
  surDecorExemple: false,
  parcelleId: null,
  parcelleNom: null,
  nbPlanches: 0,
  nbCultures: 0,
}

/**
 * Le compte a-t-il des données réelles accrochées à une parcelle restée aux
 * coordonnées d'exemple ? Lecture seule.
 */
export async function detecterLocalisationARecaler(
  userId: string
): Promise<LocalisationARecaler> {
  // Pré-filtre en base sur une boîte englobante : `estCentroidExemple` tranche
  // ensuite, pour que la tolérance ne vive qu'à un seul endroit.
  const parcelles = await prisma.parcelleGeo.findMany({
    where: {
      userId,
      centroidLat: {
        gte: PARCELLE_EXEMPLE.centroidLat - EPSILON_DEGRES,
        lte: PARCELLE_EXEMPLE.centroidLat + EPSILON_DEGRES,
      },
      centroidLng: {
        gte: PARCELLE_EXEMPLE.centroidLng - EPSILON_DEGRES,
        lte: PARCELLE_EXEMPLE.centroidLng + EPSILON_DEGRES,
      },
    },
    select: { id: true, nom: true, centroidLat: true, centroidLng: true },
  })

  const parcelle = parcelles.find((p) => estCentroidExemple(p.centroidLat, p.centroidLng))
  if (!parcelle) return RIEN_A_SIGNALER

  const [nbPlanches, nbCultures] = await Promise.all([
    prisma.planche.count({ where: { userId } }),
    prisma.culture.count({ where: { userId } }),
  ])

  return {
    aRecaler: nbPlanches > PLANCHES_EXEMPLE || nbCultures > CULTURES_EXEMPLE,
    surDecorExemple: true,
    parcelleId: parcelle.id,
    parcelleNom: parcelle.nom,
    nbPlanches,
    nbCultures,
  }
}
