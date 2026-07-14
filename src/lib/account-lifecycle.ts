/**
 * Cycle de vie d'un compte — reprise du référentiel par la communauté.
 *
 * Décision produit #2 : lorsqu'un membre est supprimé, ses entrées de référentiel
 * PARTAGÉES à la communauté (partageCommunaute=true) sont réattribuées à la
 * sentinelle « Communauté Gleba » (elles restent visibles et utilisables par les
 * autres membres, badge « Communauté »). Ses entrées PRIVÉES (partageCommunaute=false)
 * restent rattachées à son user_id et sont supprimées par le cascade au delete du
 * compte. On appelle donc reprendreReferentielCommunaute() DANS la même transaction,
 * AVANT prisma.user.delete().
 *
 * Fichier SERVEUR uniquement (utilise Prisma) — ne pas importer côté client.
 */

import type { Prisma } from '@prisma/client'

/** Id fixe du compte système sentinelle (cf. migration 20260713160000_sentinelle_communaute). */
export const COMMUNAUTE_USER_ID = 'gleba-communaute'

/**
 * Réattribue à la sentinelle « Communauté Gleba » toutes les entrées de référentiel
 * PARTAGÉES du membre `userId`, sur les 8 référentiels communautaires. Renvoie le
 * nombre total d'entrées reprises. À exécuter dans la transaction de suppression du
 * compte, avant le delete (les entrées privées, elles, partiront en cascade).
 */
export async function reprendreReferentielCommunaute(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<{ reprises: number }> {
  const where = { userId, partageCommunaute: true }
  const data = { userId: COMMUNAUTE_USER_ID }

  const resultats = await Promise.all([
    tx.espece.updateMany({ where, data }),
    tx.variete.updateMany({ where, data }),
    tx.iTP.updateMany({ where, data }),
    tx.porteGreffe.updateMany({ where, data }),
    tx.essenceBocagere.updateMany({ where, data }),
    tx.essenceForestiere.updateMany({ where, data }),
    tx.especeAnimale.updateMany({ where, data }),
    tx.raceAnimale.updateMany({ where, data }),
  ])

  return { reprises: resultats.reduce((n, r) => n + r.count, 0) }
}
