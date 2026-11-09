import type { Prisma } from '@prisma/client'

type Db = Pick<Prisma.TransactionClient, 'venteProduit' | 'abattage'>

/**
 * Un animal ne redevient pas « actif » tant qu'une vente ou un abattage non
 * annulé le vise : remis actif à la main, il gardait sa vente (recette en
 * place) et pouvait être revendu ou abattu une seconde fois. La sortie se
 * défait par l'annulation de la vente ou de l'abattage, qui réactive la fiche.
 *
 * Rend le motif du refus, ou `null` si la fiche peut être réactivée.
 */
export async function refusRemiseActif(db: Db, userId: string, animalId: number): Promise<string | null> {
  const [vente, abattage] = await Promise.all([
    db.venteProduit.findFirst({
      where: { userId, animalId, type: 'animal_vivant', annule: { not: true } },
      select: { id: true },
    }),
    db.abattage.findFirst({ where: { userId, animalId, annule: false }, select: { id: true } }),
  ])
  if (vente) {
    return 'Cet animal est sorti par une vente toujours active : annulez la vente dans Élevage > Production > Ventes, la fiche redeviendra active.'
  }
  if (abattage) {
    return 'Cet animal est sorti par un abattage toujours actif : annulez l’abattage dans Élevage > Production > Abattages, la fiche redeviendra active.'
  }
  return null
}
