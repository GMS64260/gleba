/**
 * Alerte « plus de lait sorti que collecté » : constantes partagées entre
 * l'API (`bilan-lait.ts`) et les formulaires, sans dépendance serveur.
 */

/** Code de la réponse 422 qu'un formulaire peut confirmer. */
export const CODE_LAIT_INDISPONIBLE = 'LAIT_INDISPONIBLE'

/** Champ booléen du corps de requête qui confirme la saisie malgré l'alerte. */
export const CHAMP_CONFIRMATION_LAIT = 'confirmerLaitIndisponible'
