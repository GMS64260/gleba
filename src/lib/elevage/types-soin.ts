/**
 * Types de soin, tels que l'écran les enregistre (valeur = libellé).
 *
 * Source unique pour le formulaire de soin et l'assistant. Signalement du
 * 2026-09-25 : l'assistant filtrait sur « autre » et créait des soins
 * « vermifuge » ou « traitement » en minuscules, alors que l'écran enregistre
 * « Autre », « Vermifuge », « Traitement vétérinaire » : sa recherche rendait
 * 0 soin et ses créations échappaient aux règles des soins médicamenteux.
 */

export const TYPES_SOIN: ReadonlyArray<{ valeur: string; rente: boolean }> = [
  { valeur: 'Vaccination', rente: false },
  { valeur: 'Vermifuge', rente: false },
  { valeur: 'Traitement vétérinaire', rente: false },
  { valeur: 'Castration', rente: false },
  { valeur: 'Identification', rente: false },
  { valeur: 'Tonte', rente: true },
  { valeur: 'Parage onglons', rente: true },
  { valeur: 'Prophylaxie obligatoire', rente: true },
  { valeur: 'Coproscopie', rente: true },
  { valeur: 'Mise en lutte', rente: true },
  { valeur: 'Tarissement', rente: true },
  { valeur: 'Autre', rente: false },
]

const sansAccent = (texte: string) =>
  texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/**
 * Valeur enregistrée pour une saisie libre (« traitement », « autre »…) : le
 * type de l'écran dont le libellé commence par la saisie, casse et accents
 * ignorés. Null si rien ne correspond.
 */
export function normaliserTypeSoin(saisie: string): string | null {
  const cle = sansAccent(saisie)
  if (!cle) return null
  const exact = TYPES_SOIN.find((t) => sansAccent(t.valeur) === cle)
  if (exact) return exact.valeur
  const prefixe = TYPES_SOIN.filter((t) => sansAccent(t.valeur).startsWith(cle))
  return prefixe.length === 1 ? prefixe[0].valeur : null
}
