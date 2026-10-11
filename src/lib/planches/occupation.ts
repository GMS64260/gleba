/**
 * Lecture serveur des cultures en place d'une planche, pour le verdict
 * d'occupation (`evaluerOccupationPlanche`, src/lib/planche-validation.ts).
 *
 * Un seul `select` pour la création d'une culture (POST /api/cultures) et pour
 * l'aperçu de l'assistant (GET /api/cultures/occupation) : les deux lisent les
 * mêmes colonnes, donc rendent le même verdict (QA cmv2r1v63).
 */
import type { Prisma } from '@prisma/client'

export const selectCulturesOccupation = {
  id: true,
  // `vivace` : une vivace en place occupe la planche sans fin de cycle
  // (chevauchePeriode), sa fenêtre de récolte ne la libère pas.
  espece: { select: { id: true, vivace: true } },
  dateSemis: true,
  datePlantation: true,
  dateRecolte: true,
  finRecolte: true,
  nbRangs: true,
  itp: { select: { espacementRangs: true } },
} satisfies Prisma.CultureSelect
