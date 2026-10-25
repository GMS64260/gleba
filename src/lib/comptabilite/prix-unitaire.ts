/**
 * Affichage du prix unitaire HT d'une ligne de facture : règle UNIQUE
 * (ticket cmvnuxvax, 2026-10-25).
 *
 * Une vente saisie TTC (récolte vendue 1,20 € la tige avec facture
 * automatique, TVA 5,5 %) stocke un PU HT exact de 1,20 / 1,055 =
 * 1,137440… € (`src/app/api/recoltes/[id]/route.ts`). Le PDF l'arrondissait à
 * 2 décimales : « 40 tiges × 1,14 » pour un total HT de 45,50 €. Les totaux,
 * eux, étaient justes : ils sont calculés et stockés depuis la valeur exacte,
 * jamais depuis le PU affiché.
 *
 * Règle :
 *   - 2 décimales quand elles suffisent à écrire le prix exactement
 *     (« 10,00 », « 1,50 ») ; sinon jusqu'à 4 (« 1,125 », « 1,1374 ») ;
 *     en francs Pacifique (sans centimes), 0 décimale si le prix est entier,
 *     sinon jusqu'à 2 ;
 *   - quand le PU HT ne tombe pas juste mais que le PU TTC, lui, est un
 *     montant rond (la vente a été saisie TTC), la ligne le rappelle :
 *     « soit 1,20 € TTC ».
 *
 * Un PU HT à 4 décimales reste un ARRONDI : quantité × PU HT affiché ne
 * redonne pas toujours le total HT de la ligne (29 × 1,1374 = 32,98 pour un
 * total de 32,99). La référence exacte d'une vente saisie TTC est le côté TTC :
 * quantité × PU TTC = total TTC (29 × 1,20 = 34,80), d'où la mention.
 * Arrondir le PU HT à la création de la facture (et en déduire les montants)
 * serait une décision produit, laissée à Guillaume (Gleba-comptabilite).
 *
 * Seul l'affichage change : quantité, PU et montants stockés restent exacts,
 * et le XML Factur-X / UBL garde son propre format (6 décimales,
 * `prixUnitaireXml`).
 */

import { symboleDevise } from '@/lib/format-utils'
import type { Devise } from '@/lib/territoires'

/** Décimales d'un montant dans la devise : 2 en euros, 0 en francs Pacifique. */
function decimalesMontant(devise: string): number {
  return devise === 'XPF' ? 0 : 2
}

/** Vrai si `n` s'écrit exactement avec `decimales` chiffres après la virgule. */
function estExactA(n: number, decimales: number): boolean {
  const echelle = 10 ** decimales
  return Math.abs(Math.round(n * echelle) - n * echelle) < 1e-6
}

/** Nombre de décimales à afficher pour ce prix unitaire. */
export function decimalesPrixUnitaire(prix: number, devise: string = 'EUR'): number {
  const min = decimalesMontant(devise)
  const max = min + 2
  for (let d = min; d < max; d++) {
    if (estExactA(prix, d)) return d
  }
  return max
}

function formatNombre(n: number, minimum: number, maximum: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: minimum, maximumFractionDigits: maximum })
}

/**
 * Prix unitaire sans symbole, pour une colonne « PU HT » :
 * 10 → « 10,00 », 1,20 / 1,055 → « 1,1374 ».
 */
export function formatPrixUnitaire(prix: number, devise: string = 'EUR'): string {
  const safe = Number.isFinite(prix) ? prix : 0
  return formatNombre(safe, decimalesMontant(devise), decimalesPrixUnitaire(safe, devise))
}

/**
 * PU TTC d'une ligne dont la vente a été saisie TTC : le PU HT ne s'écrit pas
 * juste en centimes, mais PU HT × (1 + taux) tombe sur un montant rond.
 * null sinon (PU HT déjà exact, ligne sans taxe, ou PU saisi HT).
 */
export function prixUnitaireTTCSaisi(
  ligne: { prixUnitaire: number; tauxTVA: number },
  devise: string = 'EUR',
): number | null {
  if (!(ligne.tauxTVA > 0) || !Number.isFinite(ligne.prixUnitaire)) return null
  const decimales = decimalesMontant(devise)
  if (estExactA(ligne.prixUnitaire, decimales)) return null
  const ttc = ligne.prixUnitaire * (1 + ligne.tauxTVA / 100)
  if (!estExactA(ttc, decimales)) return null
  const echelle = 10 ** decimales
  return Math.round(ttc * echelle) / echelle
}

/** « soit 1,20 € TTC » sous le PU HT d'une vente saisie TTC, sinon null. */
export function mentionPrixUnitaireTTC(
  ligne: { prixUnitaire: number; tauxTVA: number },
  devise: string = 'EUR',
): string | null {
  const ttc = prixUnitaireTTCSaisi(ligne, devise)
  if (ttc === null) return null
  const decimales = decimalesMontant(devise)
  return `soit ${formatNombre(ttc, decimales, decimales)} ${symboleDevise(devise as Devise)} TTC`
}
