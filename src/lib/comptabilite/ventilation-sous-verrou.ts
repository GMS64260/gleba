/**
 * HT et TVA d'une vente ou dépense manuelle corrigée, calculés sur l'écriture
 * relue SOUS le verrou des règlements.
 *
 * COM-03 (revue Codex du 2026-11-12) : le PATCH calculait HT et TVA avant le
 * verrou, depuis la lecture d'avant. Deux corrections concurrentes (TTC
 * 100 → 200 et taux 20 → 10 %) laissaient TTC 200 avec HT 90,91 et TVA 9,09.
 * COM-02 : une ventilation fournie (`montantHT`, `montantTVA`) est contrôlée
 * contre le TTC et le taux effectifs, jamais écrite telle quelle.
 *
 * Une écriture à contexte fiscal figé (caisse, boutique, écriture dérivée) ne
 * voit jamais ses montants recalculés : refus 409, sa correction passe par une
 * écriture de correction.
 */
import { ErreurReglement } from './monnaie'
import {
  contexteFiscalFige,
  MESSAGE_CONTEXTE_FISCAL_FIGE,
  refusVentilationFournie,
  ventilationRetenue,
  type Ventilation,
} from './ventilation-ttc'

const CHAMPS_FISCAUX = ['montant', 'tauxTVA', 'montantHT', 'montantTVA'] as const

export function ventilationSousVerrou(
  courante: { montant: number; tauxTVA: number | null; auto?: boolean | null; sourceType?: string | null },
  envoyes: ReadonlySet<string>,
  modification: { montant?: number; tauxTVA?: number | null },
  demande: { montantHT?: number | null; montantTVA?: number | null },
  tauxParDefaut: number,
): Ventilation | Record<string, never> {
  if (!CHAMPS_FISCAUX.some((champ) => envoyes.has(champ))) return {}
  if (contexteFiscalFige(courante)) throw new ErreurReglement(MESSAGE_CONTEXTE_FISCAL_FIGE, 409)
  const montant = modification.montant ?? courante.montant
  const taux = modification.tauxTVA ?? courante.tauxTVA ?? tauxParDefaut
  const refus = refusVentilationFournie(montant, taux, demande.montantHT, demande.montantTVA)
  if (refus) throw new ErreurReglement(refus, 400)
  return ventilationRetenue(montant, taux, demande.montantHT, demande.montantTVA)
}
