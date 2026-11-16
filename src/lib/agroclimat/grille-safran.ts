/**
 * Grille SAFRAN de Météo-France : 9 892 mailles de 8 km couvrant la France
 * métropolitaine, Corse comprise. Chaque maille est désignée par les
 * coordonnées Lambert II étendu de son centre, en hectomètres (`LAMBX`,
 * `LAMBY`), qui servent de clé dans les fichiers de données.
 *
 * Source : « coordonnees_grille_safran_lambert-2-etendu.csv », jeu « Données
 * changement climatique - SIM quotidienne », Météo-France, Licence Ouverte 2.0.
 *
 * Module serveur : le fichier de grille pèse 250 Ko, ne pas l'importer d'un
 * composant client.
 */

import grille from "./donnees/grille-safran.json"

export interface MailleSafran {
  lambx: number
  lamby: number
  /** Centre de la maille, en degrés WGS84. */
  lat: number
  lng: number
  /** Distance du point demandé au centre de la maille. */
  distanceKm: number
}

/**
 * Au-delà, le point est hors de la grille (mer, étranger, outre-mer). Le point
 * le plus éloigné d'un centre, à l'intérieur de la grille, en est à 5,7 km ; la
 * marge couvre les côtes et les îles proches.
 */
export const DISTANCE_MAX_KM = 10

const VALEURS = grille as number[]
const KM_PAR_DEGRE = 111.195

/** Clé d'une maille, telle qu'elle commence chaque ligne des fichiers SAFRAN. */
export function cleMaille(lambx: number, lamby: number): string {
  return `${lambx};${lamby}`
}

/** Maille dont le centre est le plus proche du point, ou `null` hors de la grille. */
export function mailleLaPlusProche(lat: number, lng: number): MailleSafran | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const echelleLng = Math.cos((lat * Math.PI) / 180)
  let meilleur = -1
  let meilleurCarre = Number.POSITIVE_INFINITY
  for (let i = 0; i < VALEURS.length; i += 4) {
    const dLat = VALEURS[i + 2] - lat
    const dLng = (VALEURS[i + 3] - lng) * echelleLng
    const carre = dLat * dLat + dLng * dLng
    if (carre < meilleurCarre) {
      meilleurCarre = carre
      meilleur = i
    }
  }
  if (meilleur < 0) return null
  const distanceKm = Math.sqrt(meilleurCarre) * KM_PAR_DEGRE
  if (distanceKm > DISTANCE_MAX_KM) return null
  return {
    lambx: VALEURS[meilleur],
    lamby: VALEURS[meilleur + 1],
    lat: VALEURS[meilleur + 2],
    lng: VALEURS[meilleur + 3],
    distanceKm: Math.round(distanceKm * 10) / 10,
  }
}

/** Centre d'une maille connue, ou `null` si elle n'est pas dans la grille. */
export function centreMaille(lambx: number, lamby: number): { lat: number; lng: number } | null {
  for (let i = 0; i < VALEURS.length; i += 4) {
    if (VALEURS[i] === lambx && VALEURS[i + 1] === lamby) return { lat: VALEURS[i + 2], lng: VALEURS[i + 3] }
  }
  return null
}
