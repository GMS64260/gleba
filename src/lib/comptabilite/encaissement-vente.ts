/**
 * Statut de règlement proposé à la saisie d'une vente directe.
 *
 * Décision du 2026-10-30 (Guillaume) : une vente démarre payée, comme avant le
 * 2026-10-28 ; décocher en fait une vente à crédit, qui reste à encaisser.
 * Aucun mode de règlement n'est proposé d'office : les écrans de vente n'en
 * proposaient pas avant le 2026-10-28. Les documents commerciaux (BL, facture
 * émise) ne sont pas concernés : ils restent à encaisser jusqu'à un règlement.
 */
import { todayLocalISO } from '@/lib/format-utils'

export type Encaissement = { paye: boolean; modeReglement: string }

/** Ventes d'élevage (Ventes, fiche animal, sortie de cave). */
export function encaissementVenteInitial(): Encaissement {
  return { paye: true, modeReglement: '' }
}

/**
 * « À crédit » contredit « payée » : choisir ce mode décoche la vente, et la
 * recocher retire ce mode. Renvoie les seuls champs à appliquer.
 */
export function changerEncaissement(actuel: Encaissement, changement: Partial<Encaissement>): Partial<Encaissement> {
  if (changement.modeReglement === 'À crédit') return { ...changement, paye: false }
  if (changement.paye === true && (changement.modeReglement ?? actuel.modeReglement) === 'À crédit') {
    return { ...changement, modeReglement: '' }
  }
  return changement
}

/**
 * Ventes directes du verger (fruits, bois) : « Règlement reçu » coché. Le mode
 * reste à choisir et la date du règlement est pré-remplie au jour même ; le
 * versement est journalisé à la validation.
 */
export function paiementVenteInitial() {
  return { paye: true, modeReglement: '', datePaiement: todayLocalISO() }
}
