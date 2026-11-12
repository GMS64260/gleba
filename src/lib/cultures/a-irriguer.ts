/**
 * Valeur de `Culture.aIrriguer` à la création d'une culture.
 *
 * Règle extraite de POST /api/cultures (revue du 2026-11-11) pour que les
 * autres créations (création par lot de la planification) puissent l'appliquer
 * au lieu de la recopier.
 *
 * - Un choix explicite (true ou false) fait foi.
 * - Sans choix, une espèce gourmande en eau (besoin en eau ≥ 3, ou irrigation
 *   dite « élevé ») est marquée à irriguer.
 * - Sinon la valeur reçue est rendue telle quelle (`undefined` ou `null`) : la
 *   colonne garde alors son défaut.
 */
export interface EspeceBesoinEau {
  besoinEau?: number | null
  irrigation?: string | null
}

export const SEUIL_BESOIN_EAU_A_IRRIGUER = 3

export function aIrriguerALaCreation(
  choix: boolean | null | undefined,
  espece: EspeceBesoinEau | null | undefined
): boolean | null | undefined {
  if (choix === true || choix === false) return choix
  const irrigation = espece?.irrigation?.trim().toLowerCase()
  const gourmande =
    (espece?.besoinEau != null && espece.besoinEau >= SEUIL_BESOIN_EAU_A_IRRIGUER) ||
    irrigation === 'eleve' ||
    irrigation === 'élevé'
  return gourmande ? true : choix
}
