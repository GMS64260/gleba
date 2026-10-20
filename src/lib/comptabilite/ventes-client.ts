/**
 * Nombre de ventes d'une fiche client : source unique du compteur de
 * Comptabilité > Clients (ticket cmvgeecem, 2026-10-20).
 *
 * Le compteur lisait `_count.ventesManuelles` seul. Or une vente FACTURÉE n'a
 * pas d'écriture `VenteManuelle` : la facture la porte (`createVenteFromRecolte`
 * et ses sœurs retirent le miroir dès qu'il y a `factureId`). Une vente de
 * récolte de 48 € facturée depuis Récoltes > Stock (F-2026-0007, client choisi
 * dans les suggestions) laissait donc sa fiche à « 0 ventes », alors que
 * Transactions montrait la vente avec ce client. Vérifié sur la démo : la
 * récolte et la facture portent le `clientId`, aucune `VenteManuelle` ne le porte.
 *
 * Une vente est rattachée à son client par `clientId`, sur l'une des deux
 * pièces que le KPI compte en revenus (`getKpiCompta`), quelle que soit son
 * origine :
 * - une `VenteManuelle` : saisie, ou miroir d'une récolte, d'une récolte
 *   d'arbre, d'une vente de bois, d'une commande boutique ;
 * - une `Facture` hors avoir (un avoir corrige une vente, il n'en est pas une),
 *   ni brouillon ni annulée (`STATUTS_FACTURE_HORS_VENTES`, même règle que les
 *   revenus).
 * Les deux ne se recouvrent pas : une vente facturée n'a pas de miroir.
 */

import prisma from '@/lib/prisma'
import { STATUTS_FACTURE_HORS_VENTES } from '@/lib/kpi/compta'

/** Ventes de chaque client demandé, scopées au compte ; un client sans vente vaut 0. */
export async function compterVentesParClient(
  userId: string,
  clientIds: number[],
): Promise<Map<number, number>> {
  const compte = new Map<number, number>(clientIds.map((id) => [id, 0]))
  if (clientIds.length === 0) return compte

  const [ventes, factures] = await Promise.all([
    prisma.venteManuelle.groupBy({
      by: ['clientId'],
      where: { userId, clientId: { in: clientIds } },
      _count: { _all: true },
    }),
    prisma.facture.groupBy({
      by: ['clientId'],
      where: {
        userId,
        clientId: { in: clientIds },
        type: { not: 'avoir' },
        statut: { notIn: STATUTS_FACTURE_HORS_VENTES },
      },
      _count: { _all: true },
    }),
  ])

  for (const ligne of [...ventes, ...factures]) {
    if (ligne.clientId == null || !compte.has(ligne.clientId)) continue
    compte.set(ligne.clientId, (compte.get(ligne.clientId) ?? 0) + ligne._count._all)
  }
  return compte
}
