import type { Prisma } from '@prisma/client'

/** Même ordre de verrouillage pour versements, sources et rapprochements. */
export const verrouillerReglements = (db: Prisma.TransactionClient, userId: string) =>
  db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'gleba:reglements:' + userId}))`
