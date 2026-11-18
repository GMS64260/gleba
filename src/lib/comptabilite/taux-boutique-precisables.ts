/**
 * Taux qu'un producteur peut préciser après coup pour une commande de boutique
 * antérieure à l'instantané fiscal (EC04/BL-02). Module pur (sans Prisma) :
 * une seule règle pour le gel des nouvelles commandes, la suggestion de la
 * liste, la correction côté serveur et le formulaire de l'écran.
 *
 * - Régime sans taxe (franchise 293 B, RFA, non assujetti) : 0 % seulement,
 *   comme au gel d'une nouvelle commande.
 * - Régime collectant la TVA française (réel simplifié ou normal) : taux
 *   français 0 / 2,1 / 5,5 / 10 / 20 %.
 * - Autre régime taxé hors TVA française (TGC de Nouvelle-Calédonie) : la
 *   taxe locale n'est pas nulle et ses taux ne sont pas ceux de la TVA
 *   française ; cette qualification n'est pas prise en charge ici (`null`).
 *   Jamais de zéro supposé.
 */
import { collecteTvaFrancaise } from '@/lib/territoires'

export const TAUX_BOUTIQUE_PRECISABLES = [0, 2.1, 5.5, 10, 20] as const

const REGIMES_SANS_TAXE_BOUTIQUE: readonly string[] = ['franchise-293b', 'rfa', 'non-assujetti']

/** Le régime n'applique aucune taxe sur les ventes de la boutique. */
export function regimeSansTaxeBoutique(regimeTva: string | null | undefined): boolean {
  return !!regimeTva && REGIMES_SANS_TAXE_BOUTIQUE.includes(regimeTva)
}

/** Taux précisables sous ce régime ; `null` = qualification non prise en charge (taxe locale). */
export function tauxPrecisablesBoutique(regimeTva: string): readonly number[] | null {
  if (regimeSansTaxeBoutique(regimeTva)) return [0]
  if (collecteTvaFrancaise(regimeTva)) return TAUX_BOUTIQUE_PRECISABLES
  return null
}

export const MESSAGE_REGIME_NON_PRECISABLE =
  'À la date de cette commande, le régime de l’exploitation appliquait une taxe locale (TGC) dont les taux ne se précisent pas sur cet écran : aucun taux n’est supposé. La commande reste hors CA3 ; faites qualifier sa recette par votre comptable.'
