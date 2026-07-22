import prisma from '@/lib/prisma'

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
