import type { Prisma, PrismaClient } from "@prisma/client"
import { ErreurVerger } from "./erreur"

type ObservationReprise = { id: number; date: Date; tauxReprise: number | null }

/** La date prime ; à date égale, le plus grand identifiant fait foi. */
export function calculerResumeReprise(observations: readonly ObservationReprise[]) {
  let derniere: ObservationReprise | null = null
  for (const observation of observations) {
    if (observation.tauxReprise === null) continue
    if (!derniere || observation.date.getTime() > derniere.date.getTime()
      || (observation.date.getTime() === derniere.date.getTime() && observation.id > derniere.id)) {
      derniere = observation
    }
  }
  return {
    tauxReprise: derniere?.tauxReprise ?? null,
    dateDernObservation: derniere?.date ?? null,
  }
}

export async function enregistrerObservationReprise(
  db: PrismaClient,
  data: Prisma.ObservationCampagneUncheckedCreateInput,
) {
  return db.$transaction(async (tx) => {
    // Verrou avant toute création : deux saisies du même propriétaire sont
    // sérialisées. ReadCommitted relit les observations validées après attente.
    const campagnes = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM campagnes_plantation
      WHERE id = ${data.campagneId} AND user_id = ${data.userId}
      FOR UPDATE
    `
    if (campagnes.length === 0) throw new ErreurVerger("Campagne non trouvée", 404)

    const observation = await tx.observationCampagne.create({ data })
    const observations = await tx.observationCampagne.findMany({
      where: { campagneId: data.campagneId, userId: data.userId },
      select: { id: true, date: true, tauxReprise: true },
    })
    await tx.campagnePlantation.update({
      where: { id: data.campagneId, userId: data.userId },
      data: calculerResumeReprise(observations),
    })
    return observation
  }, { isolationLevel: "ReadCommitted" })
}
