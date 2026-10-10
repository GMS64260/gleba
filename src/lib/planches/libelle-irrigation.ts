/**
 * Libellé affiché d'un système d'arrosage. La valeur enregistrée reste
 * « Goutte-a-goutte » (validation, données existantes, 2 planches au
 * 2026-10-10 contre 45 en « Goutte-à-goutte » saisies ailleurs) ; l'écran
 * l'accentue (ticket QA cmv2rgdb3).
 */
export function libelleIrrigation(valeur: string | null | undefined): string {
  if (!valeur) return ''
  return valeur.toLowerCase() === 'goutte-a-goutte' ? 'Goutte-à-goutte' : valeur
}
