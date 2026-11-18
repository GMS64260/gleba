import type { Prisma } from '@prisma/client'
import { debutDeJour } from '@/lib/operation-arbre-statut'

/** Inventaire vivant ; un état non renseigné ne signifie pas « mort ».
 * L'archivage par état conserve la fiche et toutes ses traces en base.
 */
export function filtreArbresVivants(userId: string): Prisma.ArbreWhereInput {
  return {
    userId,
    dateSuppression: null,
    OR: [{ etat: null }, { etat: { not: 'mort' } }],
  }
}

/** Les opérations soldées restent historiques, même sur un arbre mort.
 * Les autres sont conservées en base mais sortent des listes de travail.
 */
export function filtreOperationsArbresVisibles(userId: string): Prisma.OperationArbreWhereInput {
  return {
    userId,
    OR: [
      { fait: true },
      { abandonneeLe: { not: null } },
      { arbre: filtreArbresVivants(userId) },
    ],
  }
}

/** Même compteur de travail faisable pour la route et l'assistant. */
export function filtreOperationsArbresEnAttente(userId: string, maintenant: Date): Prisma.OperationArbreWhereInput {
  return {
    userId,
    arbre: filtreArbresVivants(userId),
    fait: false,
    abandonneeLe: null,
    datePrevue: { lte: maintenant },
    OR: [{ dateLimite: null }, { dateLimite: { gte: debutDeJour(maintenant) } }],
  }
}
