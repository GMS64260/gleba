/**
 * D'une culture de la base au bilan hydrique (`bilan-sol.ts`) : seul passage
 * entre les données et le moteur, partagé par le conseil des tâches
 * (`irrigation-conseil.ts`) et le conseiller du Calendrier
 * (`/api/meteo/irrigation`), pour qu'une même culture ait la même urgence et
 * la même dose sur les deux écrans.
 */
import { bilanReserveSol, dureeCycleJours, type ResultatBilanSol } from './bilan-sol'
import { jourDuLieu, jourLocalIso, type MeteoBilan } from './meteo-bilan'

export interface CultureBilan {
  espece: string
  besoinEau: number
  vivace: boolean
  dateSemis: Date | null
  datePlantation: Date | null
  semisFait: boolean
  plantationFaite: boolean
  dateRecolte: Date | null
  finRecolte: Date | null
  derniereIrrigation: Date | null
}

/**
 * Jour (AAAA-MM-JJ) de mise en place sur la planche : la plantation pour un
 * plant repiqué, le semis pour un semis direct.
 * - Un plant encore en pépinière dont la plantation est prévue PLUS TARD
 *   n'est pas encore sur la planche et ne la dessèche pas.
 * - Une plantation prévue et PASSÉE mais non cochée est supposée faite à la
 *   date prévue (32 cas sur 383 le 2026-10-10 : oubli de cocher plutôt que
 *   retard de repiquage, on ne sait pas trancher).
 * - Une plantation ou un semis cochés en avance datent du jour du lieu.
 * Les dates de calendrier sont stockées à minuit (Paris ou UTC) : le jour
 * civil du serveur est le bon.
 */
export function debutSurPlanche(c: CultureBilan, aujourdhui: string): string | null {
  const prevu = c.datePlantation ?? c.dateSemis
  if (!prevu) return null
  const fait = c.datePlantation ? c.plantationFaite : c.semisFait
  const jour = jourLocalIso(prevu)
  return fait && jour > aujourdhui ? aujourdhui : jour
}

export function bilanCulture(
  meteo: MeteoBilan,
  c: CultureBilan,
  planche: { typeSol: string | null; retentionEau: string | null },
  options: { sousAbri: boolean; arrosages: Date[] },
): ResultatBilanSol {
  // Un arrosage est daté dans le jour du lieu (un arrosage du soir aux Antilles
  // tombe le lendemain à l'heure de Paris).
  const jours = new Set(options.arrosages.map((d) => jourDuLieu(d, meteo)))
  if (c.derniereIrrigation) jours.add(jourDuLieu(c.derniereIrrigation, meteo))
  const debut = debutSurPlanche(c, meteo.aujourdhui.date)
  return bilanReserveSol({
    historique: meteo.historique,
    aujourdhui: meteo.aujourdhui,
    previsions: meteo.previsions,
    joursArroses: Array.from(jours),
    sol: planche,
    culture: {
      espece: c.espece,
      besoinEau: c.besoinEau,
      vivace: c.vivace,
      debut,
      dureeCycleJours: dureeCycleJours(
        debut,
        c.dateRecolte ? jourLocalIso(c.dateRecolte) : null,
        c.finRecolte ? jourLocalIso(c.finRecolte) : null,
      ),
      sousAbri: options.sousAbri,
    },
  })
}
