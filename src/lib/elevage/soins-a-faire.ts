/**
 * Un soin restant à faire ne vaut que pour un animal encore dans le cheptel.
 *
 * Ticket cmv294whk (QA 2026-10-10) — une agnelle déclarée morte gardait sa
 * vaccination de rappel dans les échéances, sa semaine affichait l'injection
 * avec un bouton « Fait », et le compteur la comptait parmi les soins à faire.
 * L'historique (soins faits, injections réalisées) reste intact : seules les
 * lignes à faire d'un animal sorti (mort, vendu, abattu) quittent les listes
 * d'actions. Les soins de lot restent portés, comme pour les délais
 * d'attente (`attentes-query.ts`). Un animal remis « actif » les retrouve.
 */
import { Prisma } from '@prisma/client'
import { STATUT_ACTIF } from './sortie-animal'

/** Filtre Prisma `SoinAnimal` : soin de lot, ou d'un animal encore actif. */
export function whereSoinAnimalPresent(): Prisma.SoinAnimalWhereInput {
  return { OR: [{ animalId: null }, { animal: { statut: STATUT_ACTIF } }] }
}

/**
 * Même règle en SQL brut, pour les requêtes sur `injections_soins` :
 * alias `s` = soins_animaux, `a` = animaux (LEFT JOIN sur s.animal_id).
 */
export const sqlSoinAnimalPresent = Prisma.sql`(s.animal_id IS NULL OR a.statut = ${STATUT_ACTIF})`
