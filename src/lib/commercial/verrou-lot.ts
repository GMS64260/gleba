import type { Prisma } from '@prisma/client'
import { ErreurCommerciale } from './regles'

/** Même verrou que la mise en boutique : une lecture ancienne ne peut pas revendre son lot. */
export async function verrouillerRecolteLibre(tx: Prisma.TransactionClient, userId: string, id: number) {
  await tx.$queryRaw`SELECT id FROM recoltes WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`
  const lot = await tx.recolte.findFirst({ where: { id, userId }, select: { stockDisponibleCommercial: true } })
  if (!lot) throw new ErreurCommerciale('Récolte introuvable', 404)
  if (lot.stockDisponibleCommercial != null) throw new ErreurCommerciale('Ce lot est lié à un document commercial. Utilisez son bon ou sa facture pour le reliquat ou le retour.')
  if (await tx.produitBoutique.count({ where: { userId, recolteId: id } })) throw new ErreurCommerciale('Ce lot est suivi dans le catalogue boutique, même hors ligne. Utilisez ce produit pour éviter une seconde sortie de stock.')
}
