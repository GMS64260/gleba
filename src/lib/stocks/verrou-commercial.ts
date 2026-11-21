// Import relatif : ce module est aussi chargé hors de Next par la reprise BL-01
// (scripts/reprise-recoltes-vendues-boutique.ts, image de production sans alias).
import { verrouillerReglements } from '../comptabilite/verrou-reglements'
import type { Prisma } from '@prisma/client'

/** Sérialise le point de comptage avec les sorties et retours commerciaux de la ferme. */
export async function verrouillerStockCommercial(tx: Prisma.TransactionClient, userId: string) {
  await verrouillerReglements(tx, userId)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:stock-commercial:${userId}`}))`
}

/** Même clé que les gardes SQL du stock net, avant de relire l'unité/comptage. */
export async function verrouillerStockNetRecolte(tx: Prisma.TransactionClient, userId: string, especeId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:caisse-stock-net:${userId}:${especeId}`}))`
}
