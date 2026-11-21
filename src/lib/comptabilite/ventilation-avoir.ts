/**
 * Lignes d'un avoir ventilé selon les taux de sa facture d'origine (COM-04,
 * revue Codex du 2026-11-12).
 *
 * L'écran prenait le premier taux de la facture et mettait tout le TTC de
 * l'avoir à ce taux. Un avoir se saisit désormais par taux : le montant TTC
 * de chaque taux de l'origine. Le montant complet d'un taux reprend une à une
 * les lignes de l'origine à ce taux : la TVA d'une facture est arrondie ligne
 * par ligne, si bien que le cumul d'un taux ne vaut pas toujours HT × taux
 * (huit lignes de 3,50 € HT à 5,5 % : 1,52 € de TVA, et non 1,54 €). Une
 * seule ligne au cumul serait refusée par le contrôle des lignes, et une
 * ligne recalculée depuis le TTC laisserait un solde de TVA de deux centimes.
 * Un montant partiel est ventilé au centime (HT + TVA = TTC).
 */
import { versCentimes } from './fec'
import { ventilerTTC } from './ventilation-ttc'

export interface TauxOrigine {
  taux: number
  ht: number
  tva: number
  ttc: number
  /** Lignes de l'origine à ce taux, reprises telles quelles par un avoir total. */
  lignes: Array<{ montantHT: number; montantTVA: number; montantTTC: number }>
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
  const parTaux = new Map<number, { ht: number; tva: number; ttc: number; lignes: TauxOrigine['lignes'] }>()
  for (const l of lignes ?? []) {
    const taux = Math.round(Number(l.tauxTVA) * 1000) / 1000
    const c = parTaux.get(taux) ?? { ht: 0, tva: 0, ttc: 0, lignes: [] }
    c.ht += versCentimes(Number(l.montantHT))
    c.tva += versCentimes(Number(l.montantTVA))
    c.ttc += versCentimes(Number(l.montantTTC))
    c.lignes.push({ montantHT: Number(l.montantHT), montantTVA: Number(l.montantTVA), montantTTC: Number(l.montantTTC) })
    parTaux.set(taux, c)
  }
  return [...parTaux.entries()]
    .map(([taux, c]) => ({ taux, ht: c.ht / 100, tva: c.tva / 100, ttc: c.ttc / 100, lignes: c.lignes }))
    .sort((a, b) => b.taux - a.taux)
}

/**
 * Lignes de l'avoir pour les montants TTC saisis par taux (taux absents ou
 * nuls ignorés). `rappelTaux` ajoute le taux au libellé de chaque ligne ;
 * inutile quand la facture n'en porte qu'un.
 */
export function lignesAvoirVentile(
  origine: readonly TauxOrigine[],
  ttcParTaux: Readonly<Record<string, number>>,
  motif: string,
  rappelTaux = true,
): LigneAvoir[] {
  const lignes: LigneAvoir[] = []
  for (const t of origine) {
    const ttc = versCentimes(ttcParTaux[String(t.taux)] ?? 0)
    if (ttc <= 0) continue
    const montants = ttc === versCentimes(t.ttc)
      ? t.lignes
      : [{ ...ventilerTTC(ttc / 100, t.taux), montantTTC: ttc / 100 }]
    for (const m of montants) {
      if (versCentimes(m.montantTTC) <= 0) continue
      lignes.push({
        description: rappelTaux ? `${motif} (TVA ${t.taux} %)` : motif,
        quantite: 1,
        unite: 'lot',
        prixUnitaire: m.montantHT,
        tauxTVA: t.taux,
        montantHT: m.montantHT,
        montantTVA: m.montantTVA,
        montantTTC: m.montantTTC,
      })
    }
  }
  return lignes
}
