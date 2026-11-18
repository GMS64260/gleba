import type { Prisma } from '@prisma/client'
import { ErreurVerger } from './erreur'

/** Un couple parcelle / espèce ne doit avoir qu’un mode de suivi.
 * À appeler dans la transaction d’écriture, sous le verrou commercial. */
export async function verifierSuiviIndividuel(
  tx: Prisma.TransactionClient,
  userId: string,
  parcelleGeoId: string | null,
  especes: string[],
) {
  if (!parcelleGeoId || especes.length === 0) return
  const conflit = await tx.lotArbres.findFirst({
    where: { userId, parcelleGeoId, espece: { in: especes.map((s) => s.trim()), mode: 'insensitive' } },
    select: { id: true },
  })
  if (conflit) throw new ErreurVerger('Cette espèce est déjà suivie en lot agrégé sur la parcelle ; choisissez un seul mode de suivi', 409)
}
