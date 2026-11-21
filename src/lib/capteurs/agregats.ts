/**
 * Agrégats des jours civils DU LIEU et purge du brut. On reprend tous les
 * jours encore présents, même après une interruption prolongée du cron.
 * Les colonnes Prisma sans fuseau stockent des instants UTC.
 *
 * La direction du vent n'est pas agrégée : une moyenne circulaire viendra
 * avec le lot météo (350° et 10° ne donnent pas 180°).
 *
 * Revue du 2026-10-30 : le cron traite les connecteurs UN PAR UN, chacun dans
 * sa transaction. Une seule requête pour tous les comptes s'arrêtait au
 * premier fuseau invalide (`AT TIME ZONE`, fuseau importé d'une sauvegarde)
 * ou au délai de 120 s : plus d'agrégats ni de purge pour personne.
 */
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { FUSEAUX_PROPOSES, RETENTION_MESURES_JOURS } from "./connecteurs"

export { RETENTION_MESURES_JOURS }

/** Suppression du brut d'un compte par lots courts, hors de toute longue transaction. */
export const LOT_SUPPRESSION_MESURES = 5000

/** Même verrou pour le cron et les changements de fuseau, sur tous les processus. */
export async function avecVerrouAgregats<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gleba:capteurs:agregats'))`
    return action(tx)
  }, { timeout: 120_000 })
}

/**
 * CTE `calcul`, `modifies` et `inseres` d'un connecteur. `mesures_capteurs_jours.id`
 * est un SERIAL (int4) : un `INSERT … ON CONFLICT DO UPDATE` consommait une
 * valeur de séquence par journée proposée, chaque nuit, même inchangée. On met
 * à jour les journées qui diffèrent, puis on n'insère que les absentes ; le
 * verrou consultatif écarte toute écriture concurrente de ces journées.
 *
 * Revue Codex du 2026-11-12 (CAP-01) : une journée restaurée sans son brut
 * porte une part « archive » (`archive_*`, posée par `marquerAgregatsSansBrut`)
 * qui décrit les mesures absentes du brut. Une mesure tardive de ce jour
 * (l'ingestion accepte 7 jours de retard) ne remplace plus la journée par le
 * calcul de son seul brut : `calcul` combine l'archive et le brut présent.
 * L'archive ne contenant aucune mesure du brut, rien n'est compté deux fois.
 * La part archivée reste figée ; la journée suit ensuite la purge ordinaire.
 */
function ecritureAgregats(connecteurId: string) {
  return Prisma.sql`
    brut AS (
      SELECT m."capteur_id", m."grandeur",
             ((m."mesuree_a" AT TIME ZONE 'UTC') AT TIME ZONE c."fuseau")::date AS "jour",
             min(m."valeur") AS "min", max(m."valeur") AS "max", avg(m."valeur") AS "moyenne",
             count(*)::int AS "nombre", min(m."unite") AS "unite"
      FROM "mesures_capteurs" m
      JOIN "capteurs" cap ON cap."id" = m."capteur_id"
      JOIN "connecteurs_capteurs" c ON c."id" = cap."connecteur_id"
      WHERE m."grandeur" <> 'vent_direction' AND c."id" = ${connecteurId}
      GROUP BY 1, 2, 3
    ), calcul AS (
      SELECT b."capteur_id", b."grandeur", b."jour",
             CASE WHEN a."archive_nombre" IS NULL THEN b."min" ELSE LEAST(b."min", a."archive_min") END AS "min",
             CASE WHEN a."archive_nombre" IS NULL THEN b."max" ELSE GREATEST(b."max", a."archive_max") END AS "max",
             CASE WHEN a."archive_nombre" IS NULL THEN b."moyenne"
                  ELSE (b."moyenne" * b."nombre" + a."archive_moyenne" * a."archive_nombre") / (b."nombre" + a."archive_nombre") END AS "moyenne",
             (b."nombre" + COALESCE(a."archive_nombre", 0))::int AS "nombre",
             b."unite"
      FROM brut b
      LEFT JOIN "mesures_capteurs_jours" a
        ON a."capteur_id" = b."capteur_id" AND a."grandeur" = b."grandeur" AND a."jour" = b."jour"
    ), modifies AS (
      UPDATE "mesures_capteurs_jours" a
      SET "min" = k."min", "max" = k."max", "moyenne" = k."moyenne", "nombre" = k."nombre", "unite" = k."unite"
      FROM calcul k
      WHERE a."capteur_id" = k."capteur_id" AND a."grandeur" = k."grandeur" AND a."jour" = k."jour"
        AND (a."min", a."max", a."moyenne", a."nombre", a."unite") IS DISTINCT FROM (k."min", k."max", k."moyenne", k."nombre", k."unite")
      RETURNING 1
    ), inseres AS (
      INSERT INTO "mesures_capteurs_jours" ("capteur_id", "grandeur", "jour", "min", "max", "moyenne", "nombre", "unite")
      SELECT k."capteur_id", k."grandeur", k."jour", k."min", k."max", k."moyenne", k."nombre", k."unite"
      FROM calcul k
      WHERE NOT EXISTS (
        SELECT 1 FROM "mesures_capteurs_jours" a
        WHERE a."capteur_id" = k."capteur_id" AND a."grandeur" = k."grandeur" AND a."jour" = k."jour"
      )
      RETURNING 1
    )
  `
}

const AGREGATS_ECRITS = Prisma.sql`((SELECT count(*) FROM modifies) + (SELECT count(*) FROM inseres))::int`

function agregation(connecteurId: string) {
  return Prisma.sql`WITH ${ecritureAgregats(connecteurId)} SELECT ${AGREGATS_ECRITS} AS "agregats"`
}

/**
 * Un seul snapshot SQL pour l'agrégation et la purge d'un connecteur : une
 * insertion concurrente ne peut pas être supprimée sans être comptée. On purge
 * des journées ENTIÈRES, plus anciennes que le seuil de rétention, et
 * seulement celles que `calcul` vient d'agréger (ou de trouver déjà à jour),
 * pour ne jamais recalculer un agrégat historique à partir d'un reste de journée.
 */
function agregationEtPurge(connecteurId: string) {
  return Prisma.sql`
    WITH ${ecritureAgregats(connecteurId)}, purgees AS (
      DELETE FROM "mesures_capteurs" m
      USING "capteurs" cap, "connecteurs_capteurs" c
      WHERE cap."id" = m."capteur_id" AND c."id" = cap."connecteur_id" AND c."id" = ${connecteurId}
        AND ((m."mesuree_a" AT TIME ZONE 'UTC') AT TIME ZONE c."fuseau")::date
            < ((now() - make_interval(days => ${RETENTION_MESURES_JOURS}::int)) AT TIME ZONE c."fuseau")::date
        AND (m."grandeur" = 'vent_direction' OR EXISTS (
          SELECT 1 FROM calcul k
          WHERE k."capteur_id" = m."capteur_id" AND k."grandeur" = m."grandeur"
            AND k."jour" = ((m."mesuree_a" AT TIME ZONE 'UTC') AT TIME ZONE c."fuseau")::date
        ))
      RETURNING m."id"
    )
    SELECT ${AGREGATS_ECRITS} AS "agregats", (SELECT count(*)::int FROM purgees) AS "purgees"
  `
}

export interface BilanAgregats {
  /** Journées écrites : nouvelles ou changées, pas celles déjà à jour. */
  agregats: number
  purgees: number
  /** Connecteurs en échec : journalisés, leur brut est conservé. */
  echecs: number
}

/**
 * Chaque connecteur dans sa transaction, sous le verrou commun : l'échec de
 * l'un (fuseau invalide, délai) est journalisé et n'arrête pas les suivants.
 */
async function parConnecteur(requete: (connecteurId: string) => Prisma.Sql): Promise<BilanAgregats> {
  const connecteurs = await prisma.connecteurCapteurs.findMany({
    where: { capteurs: { some: {} } }, select: { id: true }, orderBy: { id: "asc" },
  })
  const bilan: BilanAgregats = { agregats: 0, purgees: 0, echecs: 0 }
  for (const { id } of connecteurs) {
    try {
      const [ligne] = await avecVerrouAgregats((tx) => tx.$queryRaw<Array<{ agregats: number; purgees?: number }>>(requete(id)))
      bilan.agregats += ligne?.agregats ?? 0
      bilan.purgees += ligne?.purgees ?? 0
    } catch (error) {
      bilan.echecs++
      console.error(`[capteurs] Agrégation ou purge en échec pour le connecteur ${id}, brut conservé :`, error)
    }
  }
  return bilan
}

/** Le nom historique est conservé ; le rattrapage couvre désormais tout le brut disponible. */
export async function agregerMesuresRecentes(): Promise<number> {
  return (await parConnecteur(agregation)).agregats
}

/** Une purge appelée seule doit elle aussi garantir l'agrégation préalable. */
export async function purgerMesuresAnciennes(): Promise<number> {
  return (await agregerEtPurgerMesures()).purgees
}

/** Cron de 03:47 (`notifications/scheduler.ts`). */
export async function agregerEtPurgerMesures(): Promise<BilanAgregats> {
  return parConnecteur(agregationEtPurge)
}

/**
 * CAP-01 — après une restauration de compte : chaque journée d'agrégat sans
 * aucune mesure brute ce jour-là (brut omis de la sauvegarde au-delà du seuil,
 * ou déjà purgé avant elle) devient une part archivée, que l'agrégation
 * combinera à toute mesure tardive au lieu de l'écraser. Une journée dont le
 * brut a été restauré reste recalculable, sans archive. Les connecteurs au
 * fuseau hors liste (que `AT TIME ZONE` refuserait) sont laissés tels quels :
 * le cron ne les agrège pas non plus. Retourne le nombre de journées figées.
 */
export async function marquerAgregatsSansBrut(tx: Prisma.TransactionClient, userId: string): Promise<number> {
  return tx.$executeRaw`
    UPDATE "mesures_capteurs_jours" a
    SET "archive_nombre" = a."nombre", "archive_min" = a."min", "archive_max" = a."max", "archive_moyenne" = a."moyenne"
    FROM "capteurs" cap
    JOIN "connecteurs_capteurs" c ON c."id" = cap."connecteur_id"
    WHERE cap."id" = a."capteur_id" AND cap."user_id" = ${userId}
      AND a."archive_nombre" IS NULL AND a."nombre" > 0
      AND CASE WHEN c."fuseau" = ANY(${[...FUSEAUX_PROPOSES]}::text[]) THEN NOT EXISTS (
        SELECT 1 FROM "mesures_capteurs" m
        WHERE m."capteur_id" = a."capteur_id" AND m."grandeur" = a."grandeur"
          AND ((m."mesuree_a" AT TIME ZONE 'UTC') AT TIME ZONE c."fuseau")::date = a."jour"
      ) ELSE false END
  `
}

export class HistoriqueNonReconstructibleError extends Error {
  constructor() {
    super("Le fuseau ne peut plus être modifié : des mesures brutes ont déjà été purgées et leur historique ne peut pas être recalculé.")
  }
}

/**
 * À appeler après mise à jour du fuseau, dans la même transaction protégée
 * par avecVerrouAgregats. Sans le brut complet, aucun changement n'est validé.
 *
 * Ancien fuseau hors de la liste fermée (importé avant la revue du
 * 2026-10-30) : `AT TIME ZONE` le refuserait (500) et le cron n'a jamais rien
 * agrégé ni purgé pour ce connecteur. On ne le passe pas au SQL et on ne
 * supprime rien : les journées du brut sont recalculées dans le nouveau
 * fuseau, un agrégat importé sans son brut reste tel quel.
 */
export async function reconstruireAgregatsConnecteur(tx: Prisma.TransactionClient, connecteurId: string, ancienFuseau: string): Promise<void> {
  if (!FUSEAUX_PROPOSES.includes(ancienFuseau)) {
    await tx.$queryRaw(agregation(connecteurId))
    return
  }
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
  await tx.$queryRaw(agregation(connecteurId))
}

/**
 * « Vider mes données » : le brut d'un compte peut compter des millions de
 * lignes. Supprimé en cascade dans la transaction principale (délai de 5 s),
 * il la faisait échouer ; des lots courts, validés chacun seul, avancent même
 * après une interruption et laissent la cascade finale presque vide.
 */
export async function supprimerMesuresBrutesDuCompte(userId: string): Promise<number> {
  let total = 0
  for (;;) {
    const supprimees = await prisma.$executeRaw`
      DELETE FROM "mesures_capteurs" WHERE "id" IN (
        SELECT m."id" FROM "mesures_capteurs" m
        JOIN "capteurs" cap ON cap."id" = m."capteur_id"
        WHERE cap."user_id" = ${userId}
        LIMIT ${LOT_SUPPRESSION_MESURES}::int
      )
    `
    total += supprimees
    if (supprimees < LOT_SUPPRESSION_MESURES) return total
  }
}
