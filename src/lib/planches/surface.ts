/**
 * Surface d'une planche à partir de ses dimensions.
 *
 * Arrondie au centimètre carré : `0.8 * 17` vaut 13.600000000000001 en
 * flottant, et ce nombre est réellement parti à l'utilisateur dans un message
 * de l'assistant le 2026-08-05 (« Planche "Z1p4" créée (13.600000000000001
 * m²) »). Une dimension saisie au décimètre ne justifie pas quinze décimales.
 *
 * Renvoie `null` dès qu'une dimension manque : une surface ne s'invente pas à
 * partir d'une seule mesure.
 */
export function surfacePlanche(
  largeur: number | null | undefined,
  longueur: number | null | undefined,
): number | null {
  if (!largeur || !longueur) return null
  return Math.round(largeur * longueur * 100) / 100
}
