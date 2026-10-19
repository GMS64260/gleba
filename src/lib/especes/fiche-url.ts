/**
 * Adresses de la fiche espèce (`/maraichage/especes/[id]`).
 *
 * L'onglet affiché vit dans l'URL (`?tab=`), et la carte « Chez moi » (rendement,
 * unité et objectif propres à la ferme) a son ancre. La saisie de récolte y
 * renvoie pour changer l'unité de comptage d'une espèce : c'est le seul endroit
 * où elle se décide (ticket QA du 2026-10-19).
 */

export const ONGLETS_FICHE_ESPECE = [
  "general",
  "culture",
  "recolte",
  "varietes",
  "associations",
  "bioagresseurs",
  "notes",
] as const

export type OngletFicheEspece = (typeof ONGLETS_FICHE_ESPECE)[number]

export function estOngletFicheEspece(valeur: string | null | undefined): valeur is OngletFicheEspece {
  return valeur != null && (ONGLETS_FICHE_ESPECE as readonly string[]).includes(valeur)
}

/** Ancre de la carte « Chez moi », dans l'onglet Récolte. */
export const ANCRE_CHEZ_MOI = "chez-moi"

/** Lien vers la carte « Chez moi » de la fiche d'une espèce (id, jamais le nom affiché). */
export function lienChezMoiEspece(especeId: string): string {
  return `/maraichage/especes/${encodeURIComponent(especeId)}?tab=recolte#${ANCRE_CHEZ_MOI}`
}
