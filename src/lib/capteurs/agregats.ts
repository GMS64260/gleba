/**
 * Agrégats des jours civils DU LIEU et purge du brut. On reprend tous les
 * jours encore présents, même après une interruption prolongée du cron.
 * Les colonnes Prisma sans fuseau stockent des instants UTC.
 *
 * La direction du vent n'est pas agrégée : une moyenne circulaire viendra
 * avec le lot météo (350° et 10° ne donnent pas 180°).
 */
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"

export const RETENTION_MESURES_JOURS = 90

/** Même verrou pour le cron et les changements de fuseau, sur tous les processus. */
export async function avecVerrouAgregats<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gleba:capteurs:agregats'))`
    return action(tx)
  }, { timeout: 120_000 })
}

function agregation(connecteurId?: string) {
  return Prisma.sql`
    INSERT INTO "mesures_capteurs_jours" ("capteur_id", "grandeur", "jour", "min", "max", "moyenne", "nombre", "unite")
    SELECT m."capteur_id", m."grandeur",
           ((m."mesuree_a" AT TIME ZONE 'UTC') AT TIME ZONE c."fuseau")::date AS jour,
           min(m."valeur"), max(m."valeur"), avg(m."valeur"), count(*)::int, min(m."unite")
    FROM "mesures_capteurs" m
    JOIN "capteurs" cap ON cap."id" = m."capteur_id"
    JOIN "connecteurs_capteurs" c ON c."id" = cap."connecteur_id"
    WHERE m."grandeur" <> 'vent_direction'
      ${connecteurId ? Prisma.sql`AND c."id" = ${connecteurId}` : Prisma.empty}
    GROUP BY 1, 2, 3
    ON CONFLICT ("capteur_id", "grandeur", "jour") DO UPDATE
      SET "min" = EXCLUDED."min", "max" = EXCLUDED."max", "moyenne" = EXCLUDED."moyenne",
          "nombre" = EXCLUDED."nombre", "unite" = EXCLUDED."unite"
  `
}

/** Le nom historique est conservé ; le rattrapage couvre désormais tout le brut disponible. */
export async function agregerMesuresRecentes(): Promise<number> {
  return avecVerrouAgregats((tx) => tx.$executeRaw(agregation()))
}

/** Une purge appelée seule doit elle aussi garantir l'agrégation préalable. */
export async function purgerMesuresAnciennes(): Promise<number> {
  return (await agregerEtPurgerMesures()).purgees
}

/**
 * Un seul snapshot SQL pour l'agrégation et la purge : une insertion
 * concurrente ne peut pas être supprimée sans être comptée. On purge des
 * journées ENTIÈRES, plus anciennes que le seuil de rétention, pour ne jamais
 * recalculer un agrégat historique à partir d'un reste de journée.
 */
export async function agregerEtPurgerMesures(): Promise<{ agregats: number; purgees: number }> {
  return avecVerrouAgregats(async (tx) => {
    const [bilan] = await tx.$queryRaw<Array<{ agregats: number; purgees: number }>>(Prisma.sql`
      WITH agreges AS (
        ${agregation()}
        RETURNING "capteur_id", "grandeur", "jour"
      ), purgees AS (
        DELETE FROM "mesures_capteurs" m
        USING "capteurs" cap, "connecteurs_capteurs" c
        WHERE cap."id" = m."capteur_id" AND c."id" = cap."connecteur_id"
          AND ((m."mesuree_a" AT TIME ZONE 'UTC') AT TIME ZONE c."fuseau")::date
              < ((now() - make_interval(days => ${RETENTION_MESURES_JOURS}::int)) AT TIME ZONE c."fuseau")::date
          AND (m."grandeur" = 'vent_direction' OR EXISTS (
            SELECT 1 FROM agreges a
            WHERE a."capteur_id" = m."capteur_id" AND a."grandeur" = m."grandeur"
              AND a."jour" = ((m."mesuree_a" AT TIME ZONE 'UTC') AT TIME ZONE c."fuseau")::date
          ))
        RETURNING m."id"
      )
      SELECT (SELECT count(*)::int FROM agreges) AS agregats,
             (SELECT count(*)::int FROM purgees) AS purgees
    `)
    return bilan
  })
}

export class HistoriqueNonReconstructibleError extends Error {
  constructor() {
    super("Le fuseau ne peut plus être modifié : des mesures brutes ont déjà été purgées et leur historique ne peut pas être recalculé.")
  }
}

/**
 * À appeler après mise à jour du fuseau, dans la même transaction protégée
 * par avecVerrouAgregats. Sans le brut complet, aucun changement n'est validé.
 */
export async function reconstruireAgregatsConnecteur(tx: Prisma.TransactionClient, connecteurId: string, ancienFuseau: string): Promise<void> {
  const archives = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT a."id" FROM "mesures_capteurs_jours" a
    JOIN "capteurs" cap ON cap."id" = a."capteur_id"
    WHERE cap."connecteur_id" = ${connecteurId}
      AND a."nombre" > (
        SELECT count(*) FROM "mesures_capteurs" m
        WHERE m."capteur_id" = a."capteur_id" AND m."grandeur" = a."grandeur"
          AND ((m."mesuree_a" AT TIME ZONE 'UTC') AT TIME ZONE ${ancienFuseau})::date = a."jour"
      )
    LIMIT 1
  `
  if (archives.length) throw new HistoriqueNonReconstructibleError()
  await tx.mesureCapteurJour.deleteMany({ where: { capteur: { connecteurId } } })
  await tx.$executeRaw(agregation(connecteurId))
}
