/**
 * Ventilation canonique d'un montant TTC en HT et TVA, en centimes entiers.
 *
 * COM-02 (revue Codex du 2026-11-12) : les ventes et dépenses manuelles
 * acceptaient `montantHT` et `montantTVA` arbitraires et les écrivaient telles
 * quelles. Une vente de 120 € TTC à 20 % enregistrée avec HT 100 et TVA 999
 * donnait au FEC un débit de 120 pour des crédits de 1 099 (écart de 979), et
 * la CA3 déclarait 999 € de TVA collectée.
 *
 * Règle : le TTC et le taux font foi. HT = TTC / (1 + taux) arrondi au
 * centime, TVA = TTC − HT, donc HT + TVA = TTC exactement. Une ventilation
 * fournie par l'appelant n'est acceptée que si elle est cohérente : somme
 * égale au TTC au centime, TVA égale au HT × taux à un centime près (l'autre
 * sens d'arrondi d'une pièce calculée depuis le HT).
 */
import { versCentimes } from './fec'

export interface Ventilation {
  montantHT: number
  montantTVA: number
}

/** HT et TVA canoniques d'un TTC à un taux donné (en euros, exacts au centime). */
export function ventilerTTC(montantTTC: number, tauxTVA: number): Ventilation {
  const ttc = versCentimes(montantTTC)
  const ht = Math.round(ttc / (1 + tauxTVA / 100))
  return { montantHT: ht / 100, montantTVA: (ttc - ht) / 100 }
}

/**
 * Motif de refus d'une ventilation fournie, ou `null` si elle est absente ou
 * cohérente avec le TTC et le taux.
 */
export function refusVentilationFournie(
  montantTTC: number,
  tauxTVA: number,
  montantHT: number | null | undefined,
  montantTVA: number | null | undefined,
): string | null {
  const htFourni = montantHT != null
  const tvaFournie = montantTVA != null
  if (!htFourni && !tvaFournie) return null
  const ttc = versCentimes(montantTTC)
  const canon = ventilerTTC(montantTTC, tauxTVA)
  const ht = htFourni ? versCentimes(montantHT) : ttc - versCentimes(montantTVA!)
  const tva = tvaFournie ? versCentimes(montantTVA) : ttc - versCentimes(montantHT!)
  if (ht + tva !== ttc) {
    return `HT (${(ht / 100).toFixed(2)} €) + TVA (${(tva / 100).toFixed(2)} €) doit égaler le montant TTC (${(ttc / 100).toFixed(2)} €).`
  }
  if (ht < 0 || tva < 0 || Math.abs(tva - Math.round((ht * tauxTVA) / 100)) > 1) {
    return `La TVA ne correspond pas au taux de ${tauxTVA} % : pour ${(ttc / 100).toFixed(2)} € TTC, attendu HT ${canon.montantHT.toFixed(2)} € et TVA ${canon.montantTVA.toFixed(2)} €.`
  }
  return null
}

/** Ventilation à enregistrer : celle fournie si elle est cohérente (ramenée au centime), sinon la canonique. */
export function ventilationRetenue(
  montantTTC: number,
  tauxTVA: number,
  montantHT: number | null | undefined,
  montantTVA: number | null | undefined,
): Ventilation {
  if ((montantHT == null && montantTVA == null) || refusVentilationFournie(montantTTC, tauxTVA, montantHT, montantTVA)) {
    return ventilerTTC(montantTTC, tauxTVA)
  }
  const ttc = versCentimes(montantTTC)
  const ht = montantHT != null ? versCentimes(montantHT) : ttc - versCentimes(montantTVA!)
  return { montantHT: ht / 100, montantTVA: (ttc - ht) / 100 }
}

/**
 * Vrai si l'écriture a un contexte fiscal figé par sa source (caisse,
 * boutique, toute écriture dérivée) : ses montants ne se recalculent jamais
 * ici, leur correction passe par une écriture de correction. `contexteFiscal`
 * n'existe pas dans le schéma public : lu de façon défensive.
 */
export function contexteFiscalFige(ecriture: { sourceType?: string | null; auto?: boolean | null }): boolean {
  const contexte = (ecriture as { contexteFiscal?: unknown }).contexteFiscal
  return Boolean(ecriture.auto) || ecriture.sourceType != null || (contexte !== undefined && contexte !== null)
}

export const MESSAGE_CONTEXTE_FISCAL_FIGE =
  'Cette écriture vient de la caisse, de la boutique ou d’une autre source : son montant et sa TVA sont figés. Corrigez-la par une écriture de correction.'
