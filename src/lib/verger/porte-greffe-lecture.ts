import type { PorteGreffe, Prisma } from '@prisma/client'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'

type Db = Pick<Prisma.TransactionClient, 'porteGreffe'>
type ArbreAvecPorteGreffe<T> = Omit<T, 'porteGreffeRef'> & {
  porteGreffeRef: Pick<PorteGreffe, 'id' | 'nom' | 'vigueur'> | null
}

/**
 * Résout les porte-greffes visibles de l’exploitation en une requête, sans
 * lire les attributs privés d’autrui. Une privatisation masque la référence
 * jointe, jamais la liaison historique ni la saisie libre de l’arbre.
 */
export async function chargerPorteGreffesArbres<T extends { porteGreffeId: string | null }>(
  db: Db,
  userId: string,
  arbres: readonly T[],
): Promise<ArbreAvecPorteGreffe<T>[]> {
  const ids = [...new Set(arbres.flatMap(a => a.porteGreffeId ? [a.porteGreffeId] : []))]
  const references = ids.length ? await db.porteGreffe.findMany({
    where: { id: { in: ids }, ...visibiliteReferentiel(userId) },
    select: { id: true, nom: true, vigueur: true },
  }) : []
  const parId = new Map(references.map(reference => [reference.id, reference]))
  return arbres.map(arbre => ({
    ...arbre,
    porteGreffeRef: arbre.porteGreffeId ? parId.get(arbre.porteGreffeId) ?? null : null,
  }))
}
