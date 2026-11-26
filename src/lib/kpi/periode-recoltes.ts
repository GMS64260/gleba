import { finJourCivil } from '@/lib/jour-civil'

/**
 * Fin du cumul réalisé : jamais après le soir d'aujourd'hui ni après l'année
 * choisie. Le jour entier : une récolte datée du jour est stockée à minuit UTC
 * et restait hors du cumul jusqu'à 1 h ou 2 h du matin (même cause que D70).
 */
export function finRecoltesYtd(year: number, asOf: Date): Date {
  const finAnnee = new Date(year, 11, 31, 23, 59, 59, 999)
  const finJour = finJourCivil(asOf)
  return finJour < finAnnee ? finJour : finAnnee
}
