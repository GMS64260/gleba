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
 * Règle : pour chaque taux que porte le nouvel avoir, le cumul TTC des avoirs
 * non annulés à ce taux ne dépasse pas le TTC de la facture d'origine à ce
 * taux. Le contrôle porte sur le TTC et non sur le HT et la TVA : ceux-ci
 * sont arrondis ligne par ligne sur la facture et au centime sur un avoir
 * partiel, et un plafond sur leur cumul refuserait un avoir total légitime
 * dès qu'un taux regroupe plusieurs lignes. La cohérence de chaque ligne
 * (HT + TVA = TTC, TVA = HT × taux) reste contrôlée par le schéma des lignes.
 *
 * Ne sont pas contrôlés : les taux que le nouvel avoir ne touche pas (un
 * ancien avoir saisi au mauvais taux ne doit pas interdire d'en créer un
 * juste), ni une facture d'origine sans ligne (factures historiques).
 */
import { versCentimes } from './fec'

export interface LigneMontants {
  description?: string
  tauxTVA: number
  montantHT: number
  montantTVA: number
  montantTTC: number
}

/** Clé de taux stable (5.5 et 5.50000001 sont le même taux). */
const cleTaux = (taux: number) => (Math.round(taux * 1000) / 1000).toString()

type CumulTaux = { taux: number; ht: number; tva: number; ttc: number }

/** Cumul HT, TVA et TTC par taux, en centimes. */
export function ventilationParTaux(lignes: readonly LigneMontants[]): Map<string, CumulTaux> {
  const parTaux = new Map<string, CumulTaux>()
  for (const l of lignes) {
    const cle = cleTaux(l.tauxTVA)
    const cumul = parTaux.get(cle) ?? { taux: l.tauxTVA, ht: 0, tva: 0, ttc: 0 }
    cumul.ht += versCentimes(l.montantHT)
    cumul.tva += versCentimes(l.montantTVA)
    cumul.ttc += versCentimes(l.montantTTC)
    parTaux.set(cle, cumul)
  }
  return parTaux
}

const montant = (centimes: number) => (centimes / 100).toFixed(2).replace('.', ',')

/** Motif de refus de l'avoir, ou `null` s'il respecte la ventilation de l'origine. */
export function refusPlafondsAvoir(
  origine: readonly LigneMontants[],
  avoirsExistants: readonly LigneMontants[],
  nouvelAvoir: readonly LigneMontants[],
): string | null {
  if (origine.length === 0) return null
  const plafonds = ventilationParTaux(origine)
  const dejaEmis = ventilationParTaux(avoirsExistants)
  for (const [cle, n] of ventilationParTaux(nouvelAvoir)) {
    const p = plafonds.get(cle)
    if (!p) return `Le taux de ${n.taux} % ne figure pas sur la facture d'origine.`
    const cumul = (dejaEmis.get(cle)?.ttc ?? 0) + n.ttc
    // Au centime près, sans tolérance : un centime de trop par taux passait (D105).
    if (cumul > p.ttc) {
      const reste = Math.max(0, p.ttc - (dejaEmis.get(cle)?.ttc ?? 0))
      return `À ${n.taux} %, la facture d'origine porte ${montant(p.ttc)} TTC et il reste ${montant(reste)} TTC à créditer à ce taux. Répartissez l'avoir entre les taux de la facture.`
    }
  }
  return null
}
