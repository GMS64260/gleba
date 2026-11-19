import type { Prisma } from '@prisma/client'

/** Documents gardant une référence boutique à servir, sous le verrou commercial. */
export async function motifBlocageRattachementDocuments(
  db: Pick<Prisma.TransactionClient, 'ligneDocumentCommercial' | 'ligneFacture'>,
  userId: string,
  produitId: number,
): Promise<string | null> {
  const document = await db.ligneDocumentCommercial.findFirst({
    where: {
      articleStockType: 'boutique', articleStockId: String(produitId),
      document: {
        userId, factureId: null, bonLivraison: { is: null },
        OR: [
          { type: 'devis', statut: { in: ['brouillon', 'emis', 'accepte'] } },
          { type: 'livraison', statut: { in: ['brouillon', 'emis'] } },
        ],
      },
    },
    select: { id: true },
  })
  if (document) return 'Ce produit figure sur un bon ou un devis restant à servir. Terminez ou annulez ce document avant de le relier à un autre stock.'
  const facture = await db.ligneFacture.findFirst({
    where: {
      articleStockType: 'boutique', articleStockId: String(produitId),
      facture: { userId, type: 'facture', statut: 'brouillon' },
    },
    select: { id: true },
  })
  return facture ? 'Ce produit figure sur une facture brouillon. Émettez ou supprimez ce brouillon avant de le relier à un autre stock.' : null
}
