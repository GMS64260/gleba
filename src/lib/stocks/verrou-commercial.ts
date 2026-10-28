import { verrouillerReglements } from '@/lib/comptabilite/verrou-reglements'
import type { Prisma } from '@prisma/client'

/** Sérialise le point de comptage avec les sorties et retours commerciaux de la ferme. */
export async function verrouillerStockCommercial(tx: Prisma.TransactionClient, userId: string) {
  await verrouillerReglements(tx, userId)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:stock-commercial:${userId}`}))`
}
