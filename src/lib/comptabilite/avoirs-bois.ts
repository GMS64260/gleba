/**
 * Part d'un avoir qui corrige une vente de bois facturée.
 *
 * Une vente de bois facturée n'a plus de miroir comptable : sa correction
 * passe par un avoir. Le total et le module Verger le déduisaient, pas la
 * part « Bois » du graphique par catégorie (signalement FB-8Y5FFX).
 *
 * Règle, la même que le suivi commercial du verger : les lignes de l'avoir
 * liées à du bois comptent toujours ; les lignes libres, ou un avoir sans
 * ligne, ne comptent que si la facture d'origine ne porte que du bois (sinon
 * rien ne dit quelle vente elles corrigent).
 */
export interface AvoirSurBois {
  totalTTC: number
  lignes: ReadonlyArray<{ montantTTC: number; articleStockType: string | null }>
  /** La facture d'origine ne porte que des ventes de bois. */
  origineToutBois: boolean
}

export function montantBoisAvoir(avoir: AvoirSurBois): number {
  const somme = (lignes: AvoirSurBois['lignes']) => lignes.reduce((s, l) => s + (Number(l.montantTTC) || 0), 0)
  const liees = somme(avoir.lignes.filter((l) => l.articleStockType === 'bois'))
  if (!avoir.origineToutBois) return liees
  if (avoir.lignes.length === 0) return Number(avoir.totalTTC) || 0
  return liees + somme(avoir.lignes.filter((l) => !l.articleStockType))
}
