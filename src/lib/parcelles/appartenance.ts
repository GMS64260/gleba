import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * Une parcelle reçue du client (planche, objet du plan…) appartient-elle au
 * compte ? `parcelleGeoId` était écrit tel quel : une planche pouvait pointer
 * la parcelle d'une autre exploitation, dont la route renvoyait ensuite le nom,
 * la surface et le centroïde GPS (revue du 2026-11-04).
 *
 * `undefined` (champ absent) et `null` (rattachement retiré) passent toujours.
 */
export async function parcelleRefusee(
  db: Db,
  userId: string,
  parcelleGeoId: string | null | undefined,
): Promise<{ error: string; champ: 'parcelleGeoId' } | null> {
  if (parcelleGeoId === undefined || parcelleGeoId === null || parcelleGeoId === '') return null
  const parcelle = await db.parcelleGeo.findFirst({ where: { id: parcelleGeoId, userId }, select: { id: true } })
  return parcelle ? null : { error: 'Parcelle introuvable', champ: 'parcelleGeoId' }
}
