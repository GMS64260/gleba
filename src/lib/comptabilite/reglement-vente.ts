import { verrouillerReglements } from '@/lib/comptabilite/verrou-reglements'
import type { Prisma, VenteManuelle } from '@prisma/client'
import prisma from '@/lib/prisma'
import { cleMiroirReglement } from './cle-reglement'
import { verifierPointageDetaille } from './suivi-reglement-source'

export class ReglementVenteError extends Error {}

type DonneesVente = Prisma.VenteManuelleUncheckedUpdateInput

/**
 * Le pointage et son miroir comptable doivent changer dans la même transaction.
 *
 * `modification` peut être une fonction de l'écriture relue sous le verrou :
 * ce qui dépend de son état (HT et TVA recalculés, COM-03 de la revue Codex
 * du 2026-11-12) se calcule alors sur la valeur courante, pas sur la lecture
 * faite avant le verrou.
 */
export async function enregistrerReglementVente(
  userId: string,
  existing: VenteManuelle,
  modification: DonneesVente | ((courante: VenteManuelle) => DonneesVente),
) {
  const preparer = (courante: VenteManuelle) =>
    typeof modification === 'function' ? modification(courante) : modification
  return prisma.$transaction(async (tx) => {
      await verrouillerReglements(tx, userId)
    if (existing.auto) {
      // Ligne dérivée : seuls les champs de suivi passent (garde de la route),
      // qui ne dépendent pas de l'état courant.
      const intention = preparer(existing)
      if (existing.sourceType === 'commande_boutique' && typeof intention.paye === 'boolean') {
        throw new ReglementVenteError('Le paiement de cette commande se corrige dans la boutique.')
      }
      if (existing.sourceType === 'vente_produit') {
        if (existing.sourceId == null) {
          throw new ReglementVenteError('Vente d’origine introuvable. Rechargez les transactions.')
        }
        // La source est verrouillée avant son miroir, comme dans l’atelier.
        // Le prédicat est revérifié après une éventuelle attente : une vente
        // facturée ou annulée entre-temps ne peut plus être pointée ici.
        const count = typeof intention.paye === 'boolean'
          ? (await tx.venteProduit.updateMany({
              where: { id: existing.sourceId, userId, annule: false, factureId: null },
              data: { paye: intention.paye },
            })).count
          : (await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM ventes_produits WHERE id = ${existing.sourceId} AND user_id = ${userId} AND annule = false AND facture_id IS NULL FOR UPDATE`).length
        if (count !== 1) {
          throw new ReglementVenteError('Cette vente est annulée, introuvable ou déjà facturée. Rechargez la liste et suivez le règlement depuis sa source ou sa facture.')
        }
        // Une modification concurrente de la source peut avoir recréé le miroir
        // avec un nouvel id : le couple source/propriétaire reste stable.
        const where = { userId, auto: true, sourceType: 'vente_produit', sourceId: existing.sourceId }
        const miroir = await tx.venteManuelle.findFirst({ where })
        if (!miroir) throw new ReglementVenteError('Écriture introuvable. Rechargez les transactions.')
        const data = preparer(miroir)
        const projection = await verifierPointageDetaille(tx, userId, cleMiroirReglement('vente', miroir), miroir.montant, typeof data.paye === 'boolean' ? data.paye : undefined)
        return tx.venteManuelle.update({ where: { id: miroir.id, userId }, data: { ...data, ...projection } })
      }
    }
    await tx.$queryRaw`SELECT id FROM ventes_manuelles WHERE id = ${existing.id} AND user_id = ${userId} FOR UPDATE`
    const courante = await tx.venteManuelle.findFirst({ where: { id: existing.id, userId } })
    if (!courante) throw new ReglementVenteError('Écriture introuvable. Actualisez les transactions.')
    const data = preparer(courante)
    const projection = await verifierPointageDetaille(tx, userId, cleMiroirReglement('vente', courante), typeof data.montant === 'number' ? data.montant : courante.montant, typeof data.paye === 'boolean' ? data.paye : undefined)
    return tx.venteManuelle.update({ where: { id: existing.id, userId }, data: { ...data, ...projection } })
  })
}
