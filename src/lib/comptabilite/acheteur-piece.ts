import type { PrismaClient } from '@prisma/client'
import { ErreurCommerciale } from '@/lib/commercial/regles'

import { instantaneAcheteur, type InstantaneAcheteur } from '@/lib/comptabilite/rattachement-client'

type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

/**
 * BX03 (2026-11-16) — acheteur à figer sur une pièce émise, source unique de
 * la création (`creerFacture`, donc route, ventes, abattages, récoltes,
 * verger, bons commerciaux) et de l'émission d'un brouillon (PATCH /factures).
 *
 * - Avoir : l'identité archivée de sa facture d'origine est
 *   reprise telle quelle, même incomplète, comme l'émetteur.
 * - Sinon, fiche client du compte (jamais celle d'un autre compte, audit
 *   compta 2026-06) lue au moment de l'émission.
 * - Sans fiche : le nom et l'adresse saisis, rien d'autre.
 *
 * `exonere` (client exonéré de TVA) : lu sur la fiche pour une facture, un
 * acompte ou un avoir sans origine ; toujours `false` pour un avoir sur une
 * facture d'origine, dont la fiscalité est celle de l'origine.
 */
export async function acheteurPiece(
  tx: PrismaTx,
  userId: string,
  piece: { type: string; factureOrigineId?: number | null; clientId?: number | null } & Partial<{ [K in keyof InstantaneAcheteur]: InstantaneAcheteur[K] | null }>,
): Promise<{ clientId: number | null; exonere: boolean; fige: boolean; instantane: InstantaneAcheteur }> {
  // Un avoir corrige sa facture d'origine : sa TVA est celle de l'origine
  // (taux validés contre ceux de l'origine par POST /factures), jamais
  // l'exonération actuelle de la fiche, qui réécrirait lignes et totaux à
  // TVA 0 (revues QA59/ADV60 du 16/11). Vaut aussi pour une origine non figée.
  const avoirSurOrigine = piece.type === 'avoir' && !!piece.factureOrigineId
  if (avoirSurOrigine && piece.factureOrigineId) {
    const origine = await tx.facture.findFirst({
      where: { id: piece.factureOrigineId, userId },
      select: {
        clientId: true, clientNom: true, clientAdresse: true, clientSiret: true, clientSiren: true, clientTvaIntra: true,
        clientEmail: true, clientCodePostal: true, clientVille: true, clientPays: true, clientType: true, acheteurFigeLe: true,
      },
    })
    if (origine) {
      const { clientId, ...colonnes } = origine
      const instantane: InstantaneAcheteur = {
        clientNom: colonnes.clientNom, clientAdresse: colonnes.clientAdresse,
        clientSiret: colonnes.clientSiret, clientSiren: colonnes.clientSiren, clientTvaIntra: colonnes.clientTvaIntra,
        clientEmail: colonnes.clientEmail, clientCodePostal: colonnes.clientCodePostal, clientVille: colonnes.clientVille,
        clientPays: colonnes.clientPays, clientType: colonnes.clientType,
      }
      const fiche = clientId ? await tx.client.findFirst({ where: { id: clientId, userId }, select: { id: true } }) : null
      return { clientId: fiche ? clientId : null, exonere: false, fige: origine.acheteurFigeLe != null, instantane }
    }
    // Une origine absente ou étrangère ne permet pas de fabriquer son acheteur.
    throw new ErreurCommerciale('Facture d’origine introuvable : aucun avoir n’a été créé.', 404)
  }
  const fiche = piece.clientId ? await tx.client.findFirst({ where: { id: piece.clientId, userId } }) : null
  if (fiche) return { clientId: fiche.id, exonere: avoirSurOrigine ? false : fiche.exonererTVA, fige: true, instantane: instantaneAcheteur(fiche, piece.clientAdresse) }
  // Sans fiche (ou fiche supprimée depuis le brouillon) : l'identité déjà
  // portée par la pièce est gardée, jamais effacée.
  return {
    clientId: null,
    exonere: false,
    fige: true,
    instantane: {
      clientNom: piece.clientNom || 'Client anonyme', clientAdresse: piece.clientAdresse || null,
      clientSiret: piece.clientSiret ?? null, clientSiren: piece.clientSiren ?? null, clientTvaIntra: piece.clientTvaIntra ?? null,
      clientEmail: piece.clientEmail ?? null, clientCodePostal: piece.clientCodePostal ?? null, clientVille: piece.clientVille ?? null,
      clientPays: piece.clientPays ?? null, clientType: piece.clientType ?? null,
    },
  }
}
