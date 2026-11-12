/**
 * Lignes d'un avoir ventilé selon les taux de sa facture d'origine (COM-04,
 * revue Codex du 2026-11-12).
 *
 * L'écran prenait le premier taux de la facture et mettait tout le TTC de
 * l'avoir à ce taux. Un avoir se saisit désormais par taux : le montant TTC
 * de chaque taux de l'origine. Le montant complet d'un taux reprend exactement
 * le HT et la TVA de l'origine ; un montant partiel est ventilé au centime
 * (HT + TVA = TTC).
 */
import { versCentimes } from './fec'
import { ventilerTTC } from './ventilation-ttc'

export interface TauxOrigine {
  taux: number
  ht: number
  tva: number
  ttc: number
}

export interface LigneAvoir {
  description: string
  quantite: number
  unite: string
  prixUnitaire: number
  tauxTVA: number
  montantHT: number
  montantTVA: number
  montantTTC: number
}

/** Ventilation de la facture d'origine par taux, du plus fort au plus faible. */
export function ventilationOrigine(
  lignes: ReadonlyArray<{ tauxTVA: number; montantHT: number; montantTVA: number; montantTTC: number }> | undefined,
): TauxOrigine[] {
  const parTaux = new Map<number, { ht: number; tva: number; ttc: number }>()
  for (const l of lignes ?? []) {
    const taux = Math.round(Number(l.tauxTVA) * 1000) / 1000
    const c = parTaux.get(taux) ?? { ht: 0, tva: 0, ttc: 0 }
    c.ht += versCentimes(Number(l.montantHT))
    c.tva += versCentimes(Number(l.montantTVA))
    c.ttc += versCentimes(Number(l.montantTTC))
    parTaux.set(taux, c)
  }
  return [...parTaux.entries()]
    .map(([taux, c]) => ({ taux, ht: c.ht / 100, tva: c.tva / 100, ttc: c.ttc / 100 }))
    .sort((a, b) => b.taux - a.taux)
}

/** Lignes de l'avoir pour les montants TTC saisis par taux (taux absents ou nuls ignorés). */
export function lignesAvoirVentile(
  origine: readonly TauxOrigine[],
  ttcParTaux: Readonly<Record<string, number>>,
  motif: string,
): LigneAvoir[] {
  const lignes: LigneAvoir[] = []
  for (const t of origine) {
    const ttc = versCentimes(ttcParTaux[String(t.taux)] ?? 0)
    if (ttc <= 0) continue
    const { montantHT, montantTVA } =
      ttc === versCentimes(t.ttc) ? { montantHT: t.ht, montantTVA: t.tva } : ventilerTTC(ttc / 100, t.taux)
    lignes.push({
      description: `${motif} (TVA ${t.taux} %)`,
      quantite: 1,
      unite: 'lot',
      prixUnitaire: montantHT,
      tauxTVA: t.taux,
      montantHT,
      montantTVA,
      montantTTC: ttc / 100,
    })
  }
  return lignes
}
