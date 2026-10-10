/**
 * D'une culture de la base au bilan hydrique (`bilan-sol.ts`) : seul passage
 * entre les données et le moteur, partagé par le conseil des tâches
 * (`irrigation-conseil.ts`) et le conseiller du Calendrier
 * (`/api/meteo/irrigation`), pour qu'une même culture ait la même urgence et
 * la même dose sur les deux écrans.
 */
import { bilanReserveSol, dureeCycleJours, efficaciteArrosage, type ResultatBilanSol } from './bilan-sol'
import type { ArrosageSaisi } from './arrosages-saisis'
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
  planche: {
    typeSol: string | null
    retentionEau: string | null
    /** Sol de la parcelle de la planche, quand la planche n'en a pas. */
    typeSolParcelle?: string | null
    /** Système d'arrosage : part de l'eau versée qui arrive aux racines. */
    irrigation?: string | null
  },
  options: { sousAbri: boolean; arrosages: ArrosageSaisi[] },
): ResultatBilanSol {
  // Un horodatage (« Noter », intervention créée par l'assistant à l'instant)
  // est daté dans le jour du lieu : un arrosage du soir aux Antilles tombe le
  // lendemain à l'heure de Paris. Une date de calendrier (minuit à Paris ou
  // UTC, saisie du formulaire) garde son jour.
  const minuit = (d: Date) =>
    (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) || (d.getHours() === 0 && d.getMinutes() === 0)
  const jourDe = (a: { date: Date; calendaire: boolean }) =>
    a.calendaire && minuit(a.date) ? jourLocalIso(a.date) : jourDuLieu(a.date, meteo)
  const jours = new Set<string>()
  const apports: { date: string; mm: number }[] = []
  const efficacite = efficaciteArrosage(planche.irrigation)
  for (const a of options.arrosages) {
    if (a.litresParM2 === null) jours.add(jourDe(a))
    else apports.push({ date: jourDe(a), mm: a.litresParM2 * efficacite })
  }
  if (c.derniereIrrigation) jours.add(jourDuLieu(c.derniereIrrigation, meteo))
  const debut = debutSurPlanche(c, meteo.aujourdhui.date)
  return bilanReserveSol({
    historique: meteo.historique,
    aujourdhui: meteo.aujourdhui,
    previsions: meteo.previsions,
    joursArroses: Array.from(jours),
    apports,
    sol: { typeSol: planche.typeSol, retentionEau: planche.retentionEau, typeSolParcelle: planche.typeSolParcelle ?? null },
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
