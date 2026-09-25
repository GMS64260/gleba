/**
 * Constantes des déclarations réglementaires partagées entre le serveur et
 * l'écran (sans dépendance Node : `declarations-reglementaires.ts` importe
 * `node:crypto` et ne peut pas aller dans le navigateur).
 */

/**
 * Canal d'une déclaration faite en dehors de Gleba (papier, portail EDE…)
 * avant la saisie du mouvement : cas d'une reprise d'historique. L'éleveur
 * l'atteste ; les données incomplètes dans Gleba ne l'en empêchent pas, car
 * elles ne conditionnent qu'un export depuis Gleba (signalement 2026-09-25).
 */
export const CANAL_HORS_GLEBA = "Déclarée hors Gleba"
export const REFERENCE_HORS_GLEBA = "Déclaration faite hors Gleba"

/** Statuts encore à traiter, sur lesquels l'attestation hors Gleba s'applique. */
export function declarationATraiter(statut: string): boolean {
  return statut === "A_COMPLETER" || statut === "A_DECLARER" || statut === "HORS_DELAI"
}
