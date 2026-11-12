/**
 * Plafonds d'un avoir par taux de TVA.
 *
 * COM-04 (revue Codex du 2026-11-12) : l'écran d'avoir prenait le premier
 * taux de la facture d'origine et le serveur ne vérifiait que deux choses :
 * le TTC cumulé des avoirs et l'appartenance du taux à la facture. Origine
 * 100 € HT à 20 % + 100 € HT à 5,5 % = 225,50 € TTC dont 25,50 € de TVA ;
 * un avoir total de 225,50 € à 20 % retirait 37,58 € de TVA collectée, soit
 * un solde de −12,08 € au lieu de 0, et faussait le chiffre d'affaires HT par
 * taux de la CA3.
 *
 * Règle : chaque ligne d'avoir est cohérente (HT + TVA = TTC, TVA = HT × taux
 * au centime près), et, pour chaque taux, le cumul HT et TVA des avoirs non
 * annulés ne dépasse pas celui de la facture d'origine. Un avoir total
 * reprend donc nécessairement la ventilation de l'origine.
 */
import { versCentimes } from './fec'
import { refusVentilationFournie } from './ventilation-ttc'

export interface LigneMontants {
  description?: string
  tauxTVA: number
  montantHT: number
  montantTVA: number
  montantTTC: number
}

/** Clé de taux stable (5.5 et 5.50000001 sont le même taux). */
const cleTaux = (taux: number) => (Math.round(taux * 1000) / 1000).toString()

/** Cumul HT et TVA par taux, en centimes. */
export function ventilationParTaux(lignes: readonly LigneMontants[]): Map<string, { taux: number; ht: number; tva: number }> {
  const parTaux = new Map<string, { taux: number; ht: number; tva: number }>()
  for (const l of lignes) {
    const cle = cleTaux(l.tauxTVA)
    const cumul = parTaux.get(cle) ?? { taux: l.tauxTVA, ht: 0, tva: 0 }
    cumul.ht += versCentimes(l.montantHT)
    cumul.tva += versCentimes(l.montantTVA)
    parTaux.set(cle, cumul)
  }
  return parTaux
}

const euros = (centimes: number) => `${(centimes / 100).toFixed(2).replace('.', ',')} €`

/** Motif de refus de l'avoir, ou `null` s'il respecte la ventilation de l'origine. */
export function refusPlafondsAvoir(
  origine: readonly LigneMontants[],
  avoirsExistants: readonly LigneMontants[],
  nouvelAvoir: readonly LigneMontants[],
): string | null {
  for (const l of nouvelAvoir) {
    const refus = refusVentilationFournie(l.montantTTC, l.tauxTVA, l.montantHT, l.montantTVA)
    if (refus) return `Ligne d'avoir${l.description ? ` « ${l.description} »` : ''} : ${refus}`
  }
  const plafonds = ventilationParTaux(origine)
  const cumul = ventilationParTaux([...avoirsExistants, ...nouvelAvoir])
  for (const [cle, c] of cumul) {
    const p = plafonds.get(cle)
    if (!p) return `Le taux de ${c.taux} % ne figure pas sur la facture d'origine.`
    if (c.ht > p.ht + 1 || c.tva > p.tva + 1) {
      return `À ${c.taux} %, les avoirs atteindraient ${euros(c.ht)} HT et ${euros(c.tva)} de TVA, pour ${euros(p.ht)} HT et ${euros(p.tva)} de TVA sur la facture d'origine. Ventilez l'avoir selon les taux de la facture.`
    }
  }
  return null
}
