/**
 * Une intervention réalisée ne se date pas dans le futur (ticket QA
 * cmv3jatw8 : un arrosage du 12/10 coché « réalisé » le 11/10 brouillait le
 * dernier arrosage du conseil d'irrigation). Seule règle de la route
 * Interventions, de « Noter » avec quantité et de l'assistant.
 *
 * Un jour de marge : le jour civil du serveur (Paris) retarde sur l'Outre-mer
 * de l'Est (Nouvelle-Calédonie UTC+11, La Réunion) ; l'écran, lui, compare au
 * jour du navigateur, sans marge.
 */
import { jourLocalISO } from '@/lib/accueil/classement'

export function apresDemain(date: Date, maintenant: Date = new Date()): boolean {
  const demain = new Date(maintenant)
  demain.setDate(demain.getDate() + 1)
  return jourLocalISO(date) > jourLocalISO(demain)
}

export const MESSAGE_REALISEE_FUTURE =
  "Une intervention réalisée se date au plus tard aujourd'hui. Datez-la du jour où elle a été faite, ou laissez-la planifiée."
