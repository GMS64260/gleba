/**
 * Portée du sélecteur d'année du verger.
 *
 * Signalement QA du 2026-10-19 : le sélecteur d'année de l'en-tête du verger
 * était affiché sur tous les onglets, mais seul le Calendrier le lisait ;
 * l'onglet Opérations, entre autres, listait toutes les années sans le dire.
 *
 * Règle : l'année (URL `?annee=`, puis préférence `gleba_verger_year`, voir
 * `useAnneeModule`) filtre les onglets listés ici. Les autres onglets portent
 * volontairement toutes les années et l'en-tête l'indique (« Toutes années ») :
 *   - Arbres, Plantations, Référentiel : inventaires, sans exercice ;
 *   - Productions : récoltes et bois de toutes les campagnes (le stock d'une
 *     récolte passée reste à vendre l'année suivante) ;
 *   - Santé & Phyto : le registre phytosanitaire se conserve sur plusieurs
 *     années (revue du 2026-09-28) ; la pollinisation n'a pas d'exercice.
 */

/** Clé `localStorage` de l'année choisie dans le verger (inchangée depuis cmsogh2sw). */
export const CLE_ANNEE_VERGER = "gleba_verger_year"

/** Onglets du verger filtrés par l'année du sélecteur. */
export const ONGLETS_VERGER_PAR_ANNEE = ["calendrier", "operations"] as const

export function ongletVergerSuitAnnee(onglet: string): boolean {
  return (ONGLETS_VERGER_PAR_ANNEE as readonly string[]).includes(onglet)
}
