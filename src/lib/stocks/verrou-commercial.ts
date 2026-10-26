import type { Prisma } from '@prisma/client'

/** Sérialise le point de comptage avec les sorties et retours commerciaux de la ferme. */
export async function verrouillerStockCommercial(tx: Prisma.TransactionClient, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:stock-commercial:${userId}`}))`
}
