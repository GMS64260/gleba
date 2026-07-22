import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'

type Db = typeof prisma | Prisma.TransactionClient

export async function isAssignableAnimalLot(
  userId: string,
  rawLotId: unknown,
  especeAnimaleId: string
): Promise<boolean> {
  const lotId = typeof rawLotId === 'number' ? rawLotId : Number(rawLotId)
  if (!Number.isInteger(lotId) || lotId <= 0) return false

  const lot = await prisma.lotAnimaux.findFirst({
    where: {
      id: lotId,
      userId,
      statut: 'actif',
      especeAnimaleId,
    },
    select: { id: true },
  })

  return lot !== null
}

/**
 * Vrai si la parcelle géoréférencée existe et appartient au user.
 * Sert au rattachement direct d'un animal à une parcelle (cartographie élevage).
 */
export async function isOwnedParcelle(userId: string, rawParcelleId: unknown): Promise<boolean> {
  if (rawParcelleId == null || rawParcelleId === '') return false
  const parcelle = await prisma.parcelleGeo.findFirst({
    where: { id: String(rawParcelleId), userId },
    select: { id: true },
  })
  return parcelle !== null
}

export async function enregistrerChangementLot(
  db: Db,
  userId: string,
  animalId: number,
  ancienLotId: number | null,
  nouveauLotId: number | null,
  dateEffet = new Date(),
  motif = 'Modification de la fiche animal'
) {
  if (ancienLotId === nouveauLotId) return
  await db.$executeRaw(Prisma.sql`
    UPDATE "historique_lots_animaux"
    SET "date_fin" = ${dateEffet}
    WHERE "user_id" = ${userId} AND "animal_id" = ${animalId} AND "date_fin" IS NULL
  `)
  if (nouveauLotId != null) {
    await db.$executeRaw(Prisma.sql`
      INSERT INTO "historique_lots_animaux"
        ("id", "user_id", "animal_id", "lot_id", "date_debut", "motif")
      VALUES (${randomUUID()}, ${userId}, ${animalId}, ${nouveauLotId}, ${dateEffet}, ${motif})
    `)
  }
}
