/**
 * Lecture serveur des cultures en place d'une planche, pour le verdict
 * d'occupation (`evaluerOccupationPlanche`, src/lib/planche-validation.ts).
 *
 * Un seul `select` pour la création d'une culture (POST /api/cultures) et pour
 * l'aperçu de l'assistant (GET /api/cultures/occupation) : les deux lisent les
 * mêmes colonnes, donc rendent le même verdict (QA cmv2r1v63).
 */
import type { Prisma } from '@prisma/client'
import { estVivaceEnPlace } from '@/lib/cultures/fenetre-recolte'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'

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
  // Portion cultivée : deux cultures bout à bout ne se prennent pas de largeur.
  longueur: true,
  itp: { select: { espacementRangs: true } },
} satisfies Prisma.CultureSelect

/**
 * Une culture à créer est-elle une vivace en place ? Même lecture que ses
 * voisines et que la culture modifiée (`controlerOccupationModification`) :
 * `estVivaceEnPlace` sur une culture non terminée, d'après `espece.vivace` de
 * son espèce réelle (revue-adv-183 : la création évaluait toute nouvelle
 * culture comme une annuelle bornée à sa fenêtre de récolte).
 */
export function vivaceACreer(especeVivace: boolean | null | undefined): boolean {
  return estVivaceEnPlace({ terminee: null, espece: { vivace: especeVivace } })
}

/**
 * `vivace` des espèces demandées, lues dans le référentiel visible du compte
 * (catalogue Gleba, partagées, espèces de l'exploitation) : la règle qui
 * autorise POST /api/cultures à rattacher une culture à une espèce. Une espèce
 * absente de la carte est introuvable ou privée d'une autre exploitation.
 */
export async function lireVivaceEspeces(
  db: Pick<Prisma.TransactionClient, 'espece'>,
  userId: string,
  especeIds: string[],
): Promise<Map<string, boolean>> {
  const ids = [...new Set(especeIds.filter(Boolean))]
  if (ids.length === 0) return new Map()
  const especes = await db.espece.findMany({
    where: { AND: [{ id: { in: ids } }, visibiliteReferentiel(userId)] },
    select: { id: true, vivace: true },
  })
  return new Map(especes.map((e) => [e.id, e.vivace]))
}
