/**
 * Constantes de l'arrosage partagées par le conseil des tâches
 * (src/lib/irrigation-conseil.ts), le conseiller du Calendrier
 * (src/lib/meteo-agro.ts) et le moteur de bilan hydrique
 * (src/lib/irrigation/bilan-sol.ts). Module pur, importable côté client.
 */

/**
 * Pluie qui compte comme un apport d'eau (mm/jour). Une bruine de 1 mm ne
 * remet pas à zéro les « jours sans eau » : elle masquait un vrai déficit.
 */
export const SEUIL_PLUIE_SIGNIFICATIVE = 3

// Les seuils de déficit sur 7 jours (15 et 25 mm) ont cédé la place, le
// 2026-10-10, au bilan de la réserve du sol : l'urgence se lit désormais par
// rapport à la réserve facilement utilisable de chaque culture
// (src/lib/irrigation/bilan-sol.ts).

/** Une culture dont la récolte est finie depuis plus longtemps n'est plus à arroser. */
export const JOURS_APRES_FIN_RECOLTE = 14

/**
 * Sans fin de récolte connue, `dateRecolte` n'est que le DÉBUT de la récolte :
 * une courgette récoltée tout l'été sortirait 14 jours après sa première
 * récolte. Marge plus large dans ce cas.
 */
export const JOURS_APRES_DEBUT_RECOLTE_SANS_FIN = 60
