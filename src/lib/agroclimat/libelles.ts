/**
 * Libellés des dates climatiques. Sans dépendance serveur : utilisable d'un
 * composant client.
 */

import { jourDeLaCase } from "./calendrier"

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

/** « 12 avril », « 1er mai » : la date d'une case du calendrier à 366 cases. */
export function libelleCase(index: number): string {
  const { mois, jour } = jourDeLaCase(index)
  return `${jour === 1 ? "1er" : jour} ${MOIS[mois - 1]}`
}
