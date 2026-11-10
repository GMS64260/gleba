/**
 * Durées de conservation promises par /confidentialite, appliquées chaque nuit.
 *
 * La page annonce « Journaux de connexion : 12 mois » et « Consentement aux
 * cookies : 13 mois au maximum », mais aucune tâche ne purgeait ces tables :
 * une connexion manquée (adresse saisie, IP, navigateur) restait en base pour
 * toujours (revue du 2026-11-04). Les autres durées de la page ont déjà leur
 * purge (erreurs d'API, relevés bancaires, mesures des capteurs).
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import prisma from '@/lib/prisma'

type Db = PrismaClient | Prisma.TransactionClient

/** Journaux de connexion : 12 mois. */
export const RETENTION_JOURNAL_CONNEXION_MOIS = 12
/** Consentement aux cookies : 13 mois au maximum (délibération CNIL 2020-091). */
export const RETENTION_CONSENTEMENT_MOIS = 13

function moisAvant(maintenant: Date, mois: number): Date {
  const limite = new Date(maintenant)
  limite.setMonth(limite.getMonth() - mois)
  return limite
}

export async function purgerDonneesExpirees(
  maintenant: Date = new Date(),
  db: Db = prisma,
): Promise<{ connexions: number; consentements: number }> {
  const [connexions, consentements] = await Promise.all([
    db.loginLog.deleteMany({
      where: { createdAt: { lt: moisAvant(maintenant, RETENTION_JOURNAL_CONNEXION_MOIS) } },
    }),
    db.cookieConsent.deleteMany({
      where: { createdAt: { lt: moisAvant(maintenant, RETENTION_CONSENTEMENT_MOIS) } },
    }),
  ])
  return { connexions: connexions.count, consentements: consentements.count }
}
