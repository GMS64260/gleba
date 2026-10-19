/**
 * Ventes rattachées aux récoltes d'une culture, qui interdisent de la supprimer.
 *
 * Audit 2026-10-08 : `DELETE /api/cultures/[id]` emportait ses récoltes en
 * cascade (`Recolte.culture`, `onDelete: Cascade`) et effaçait au passage leurs
 * ventes automatiques, y compris sur un exercice déjà déclaré (FEC, TVA). Un
 * clic sur une culture faisait disparaître du chiffre d'affaires sans trace.
 *
 * Règle : une culture se supprime seulement si aucune de ses récoltes n'est
 * vendue. Une récolte est vendue quand elle porte le statut « vendu », une
 * facture, ou une écriture de vente en comptabilité. Pour s'en sortir, on
 * supprime d'abord ces ventes : supprimer une récolte vendue depuis
 * Maraîchage > Récoltes retire son écriture de vente, et refuse tant qu'une
 * facture payée n'a pas d'avoir (`annulerFactureLiee`). Les récoltes non
 * vendues, elles, partent avec la culture, comme avant (l'écran l'annonce).
 *
 * Gleba n'a pas de notion d'exercice clos (vérifié le 2026-10-19 : ni modèle ni
 * verrou de clôture) : la règle couvre tous les exercices, sans exception.
 *
 * Toute suppression de culture passe par ici : la route et l'assistant (zone
 * privée, `delete_culture`).
 */

import type { Prisma, PrismaClient } from '@prisma/client'

type Tx = Prisma.TransactionClient | PrismaClient

export interface VentesRecoltesCulture {
  /** Toutes les récoltes de la culture. */
  recoltes: number
  /** Récoltes vendues : statut « vendu », facturées, ou portant une vente. */
  recoltesVendues: number
  /** Écritures de vente (recettes) dérivées de ces récoltes. */
  ventes: number
  /** Factures distinctes rattachées à ces récoltes. */
  factures: number
}

export async function compterVentesRecoltesCulture(
  tx: Tx,
  cultureId: number,
  userId: string
): Promise<VentesRecoltesCulture> {
  const recoltes = await tx.recolte.findMany({
    where: { cultureId, userId },
    select: { id: true, statut: true, factureId: true },
  })
  if (recoltes.length === 0) return { recoltes: 0, recoltesVendues: 0, ventes: 0, factures: 0 }

  // Toute écriture dérivée d'une de ces récoltes, automatique ou non.
  const ventes = await tx.venteManuelle.findMany({
    where: { userId, sourceType: 'recolte', sourceId: { in: recoltes.map((r) => r.id) } },
    select: { sourceId: true },
  })
  const avecVente = new Set(ventes.map((v) => v.sourceId))
  const vendues = recoltes.filter((r) => r.statut === 'vendu' || r.factureId != null || avecVente.has(r.id))

  return {
    recoltes: recoltes.length,
    recoltesVendues: vendues.length,
    ventes: ventes.length,
    factures: new Set(recoltes.map((r) => r.factureId).filter((id): id is number => id != null)).size,
  }
}

export function aDesVentes(ventes: VentesRecoltesCulture): boolean {
  return ventes.recoltesVendues > 0
}

const pluriel = (n: number, singulier: string, plurielForme: string) =>
  `${n} ${n > 1 ? plurielForme : singulier}`

/**
 * Message de refus : combien de récoltes et de ventes retiennent la culture, et
 * par où commencer.
 */
export function messageSuppressionCultureRefusee(
  culture: { id: number; especeId: string },
  ventes: VentesRecoltesCulture
): string {
  const pieces = [
    ventes.ventes > 0 ? pluriel(ventes.ventes, 'vente en comptabilité', 'ventes en comptabilité') : null,
    ventes.factures > 0 ? pluriel(ventes.factures, 'facture', 'factures') : null,
  ].filter((p): p is string => p !== null)
  const detail = pieces.length > 0 ? ` (${pieces.join(' et ')})` : ''
  const vendues =
    ventes.recoltesVendues === ventes.recoltes
      ? pluriel(ventes.recoltesVendues, 'récolte vendue', 'récoltes vendues')
      : `${pluriel(ventes.recoltesVendues, 'récolte vendue', 'récoltes vendues')} sur ${ventes.recoltes}`
  return (
    `La culture #${culture.id} (${culture.especeId}) a ${vendues}${detail} : la supprimer effacerait ces ventes de la comptabilité. ` +
    `Supprimez d'abord les ventes : dans Maraîchage > Récoltes, supprimer une récolte vendue retire sa vente (une facture payée demande d'abord un avoir). ` +
    `Supprimez ensuite la culture.`
  )
}
