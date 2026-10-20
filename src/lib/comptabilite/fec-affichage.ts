/**
 * Montants du contrôle d'équilibre FEC (Comptabilité > Export, bouton
 * « Vérifier l'équilibre »), ticket cmvge803p du 2026-10-20.
 *
 * L'écran affichait `toFixed(2)` : « 47224.12 € », « 0.00 € ». Il passe par le
 * formateur partagé (`formatMontantDevise`, « 47 224,12 € »). Le FEC n'existe
 * qu'en euros (`fecApplicable`, `src/lib/territoires.ts`).
 *
 * Un écart arrondi au centime peut valoir -0 (`Math.round(-0,001 × 100) / 100`
 * dans `validerEquilibre`) : `Intl` l'écrirait « -0,00 € ». Le montant est donc
 * ramené au centime et le zéro négatif neutralisé.
 */

import { formatMontantDevise } from '@/lib/format-utils'

export function formatMontantFec(montant: number): string {
  const centimes = Math.round((Number.isFinite(montant) ? montant : 0) * 100) / 100
  return formatMontantDevise(centimes === 0 ? 0 : centimes, 'EUR')
}
