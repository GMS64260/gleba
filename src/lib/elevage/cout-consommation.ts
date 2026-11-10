/**
 * Coût d'une consommation d'aliment.
 *
 * Le prix d'un aliment change d'un achat à l'autre : valoriser une
 * consommation passée au prix du jour faisait bouger le coût des mois écoulés
 * à chaque mise à jour du prix. L'écriture de gestion créée à la saisie
 * (`consommation_aliment`) porte le montant au prix d'alors : il fait foi. Le
 * prix du jour ne sert que pour une consommation sans écriture (coût nul à la
 * saisie, donnée antérieure aux écritures).
 */
import type { Prisma } from '@prisma/client'

type Db = Pick<Prisma.TransactionClient, 'depenseManuelle'>

export type PrixAliment = {
  prix?: number | null
  userStocks?: { prix?: number | null; coutUnitaire?: number | null }[] | null
} | null | undefined

/** Prix du jour : coût unitaire du stock, sinon son prix, sinon celui du catalogue. Zéro est un prix connu. */
export function prixDuJourAliment(aliment: PrixAliment): number {
  return aliment?.userStocks?.[0]?.coutUnitaire ?? aliment?.userStocks?.[0]?.prix ?? aliment?.prix ?? 0
}

/** PUR : montant figé s'il existe, sinon quantité × prix du jour. */
export function coutConsommation(
  consommation: { id: number; quantite: number; aliment?: PrixAliment },
  montantsFiges: ReadonlyMap<number, number>,
): number {
  const fige = montantsFiges.get(consommation.id)
  return fige !== undefined ? fige : Number(consommation.quantite) * prixDuJourAliment(consommation.aliment)
}

/** Montants figés des consommations données, lus sur leurs écritures de gestion. */
export async function chargerMontantsFigesConsommations(db: Db, userId: string, ids: number[]): Promise<Map<number, number>> {
  const montants = new Map<number, number>()
  if (ids.length === 0) return montants
  const ecritures = await db.depenseManuelle.findMany({
    where: { userId, auto: true, sourceType: 'consommation_aliment', sourceId: { in: ids } },
    select: { sourceId: true, montant: true },
  })
  for (const e of ecritures) {
    if (e.sourceId != null) montants.set(e.sourceId, (montants.get(e.sourceId) ?? 0) + Number(e.montant))
  }
  return montants
}
