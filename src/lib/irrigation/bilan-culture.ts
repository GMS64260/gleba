/**
 * D'une culture de la base au bilan hydrique (`bilan-sol.ts`) : seul passage
 * entre les données et le moteur, partagé par le conseil des tâches
 * (`irrigation-conseil.ts`) et le conseiller du Calendrier
 * (`/api/meteo/irrigation`), pour qu'une même culture ait la même urgence et
 * la même dose sur les deux écrans.
 */
import { bilanReserveSol, dureeCycleJours, efficaciteArrosage, joursEntre, noteSol, type ResultatBilanSol } from './bilan-sol'
import { formatNombre } from '@/lib/accueil/classement'
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

/**
 * Jour du lieu (AAAA-MM-JJ) d'un arrosage saisi. Un horodatage (« Noter »,
 * intervention créée par l'assistant à l'instant) est daté dans le jour du
 * lieu : un arrosage du soir aux Antilles tombe le lendemain à l'heure de
 * Paris. Une date de calendrier (minuit à Paris ou UTC, saisie du
 * formulaire) garde son jour.
 */
function jourArrosage(a: { date: Date; calendaire: boolean }, meteo: MeteoBilan): string {
  const minuit = (d: Date) =>
    (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) || (d.getHours() === 0 && d.getMinutes() === 0)
  return a.calendaire && minuit(a.date) ? jourLocalIso(a.date) : jourDuLieu(a.date, meteo)
}

/**
 * Dernier arrosage, jugé dans le jour du LIEU : un arrosage daté d'après
 * aujourd'hui (intervention « réalisée » saisie d'avance) ne compte pas. Il
 * était affiché « Dernier arrosage : 12/10 » et « Arrosée aujourd'hui » le
 * 11/10, alors que le bilan l'ignorait (ticket QA cmv3jatw8).
 */
export function dernierArrosageDuLieu(
  meteo: MeteoBilan,
  derniereIrrigation: Date | null,
  arrosages: ArrosageSaisi[],
): { date: Date; jour: string } | null {
  const saisies = [
    ...arrosages.map((a) => ({ date: a.date, jour: jourArrosage(a, meteo) })),
    ...(derniereIrrigation ? [{ date: derniereIrrigation, jour: jourDuLieu(derniereIrrigation, meteo) }] : []),
  ].filter((s) => s.jour <= meteo.aujourdhui.date)
  return saisies.reduce<{ date: Date; jour: string } | null>(
    (dernier, s) => (!dernier || s.jour > dernier.jour || (s.jour === dernier.jour && s.date > dernier.date) ? s : dernier),
    null,
  )
}

/**
 * Jours de calendrier du lieu depuis le dernier arrosage (0 = aujourd'hui),
 * null si aucun. Pas une division d'horodatages : un arrosage noté à 23 h
 * n'est plus « aujourd'hui » le lendemain matin. Seule règle du conseiller,
 * des tâches et de la page Irriguer.
 */
export function joursDepuisArrosage(
  meteo: MeteoBilan,
  derniereIrrigation: Date | null,
  arrosages: ArrosageSaisi[],
): number | null {
  const dernier = dernierArrosageDuLieu(meteo, derniereIrrigation, arrosages)
  return dernier ? joursEntre(dernier.jour, meteo.aujourdhui.date) : null
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
  /** `sousAbri` : null quand le type de planche n'est pas renseigné (`typeSousAbri`). */
  options: { sousAbri: boolean | null; arrosages: ArrosageSaisi[] },
): ResultatBilanSol {
  const jourDe = (a: ArrosageSaisi) => jourArrosage(a, meteo)
  const jours = new Set<string>()
  const apports: { date: string; mm: number }[] = []
  const efficacite = efficaciteArrosage(planche.irrigation)
  for (const a of options.arrosages) {
    if (a.litresParM2 === null) jours.add(jourDe(a))
    else apports.push({ date: jourDe(a), mm: a.litresParM2 * efficacite })
  }
  if (c.derniereIrrigation) jours.add(jourDuLieu(c.derniereIrrigation, meteo))
  const debut = debutSurPlanche(c, meteo.aujourdhui.date)
  const bilan = (sousAbri: boolean) => bilanReserveSol({
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
      sousAbri,
    },
  })
  if (options.sousAbri !== null) return bilan(options.sousAbri)

  // Type de planche non renseigné (ticket QA cmv3ja7nr) : la pluie n'est
  // comptée qu'en plein champ, et on ne la crédite plus en silence.
  // - Seule la pluie évite l'arrosage : le conseil ne tranche pas (« À
  //   surveiller », sans dose, les deux réponses).
  // - À arroser dans les deux cas : l'urgence commune, la dose la plus forte,
  //   pas de pluie affichée, les deux chiffres dans le motif.
  // - Ni l'un ni l'autre : le type ne change rien aujourd'hui (l'écran
  //   signale quand même la planche à compléter).
  const plein = bilan(false)
  const abri = bilan(true)
  const aArroser = (r: ResultatBilanSol) => r.doseMm > 0 && (r.urgence === 'critique' || r.urgence === 'haute')
  if (aArroser(abri) && !aArroser(plein)) {
    return {
      ...plein,
      urgence: 'moyenne',
      doseMm: 0,
      raison:
        `Type de planche à renseigner : sous serre ou tunnel, sans pluie, la planche serait à arroser ` +
        `(${formatNombre(abri.doseMm, 1)} mm au sol) ; en plein champ, ${minuscule(plein.raison)}`,
    }
  }
  if (!aArroser(plein) || !aArroser(abri)) return plein
  const rang = { critique: 0, haute: 1, moyenne: 2, faible: 3, aucune: 4 } as const
  // L'urgence certaine (la moindre des deux) et l'état de réserve qui va avec :
  // pas de courriel « critique » sur une seule hypothèse.
  const base = rang[plein.urgence] >= rang[abri.urgence] ? plein : abri
  const sansArrosage = jours.size === 0 && apports.length === 0 ? ' Aucun arrosage noté.' : ''
  const sol = noteSol({ typeSol: planche.typeSol, retentionEau: planche.retentionEau, typeSolParcelle: planche.typeSolParcelle ?? null })
  return {
    ...base,
    doseMm: Math.max(plein.doseMm, abri.doseMm),
    pluiePrevue48h: 0,
    raison:
      `Type de planche à renseigner : à arroser sous abri comme en plein champ. ` +
      `Sous serre ou tunnel, sans pluie : ${formatNombre(abri.doseMm, 1)} mm au sol ; ` +
      `en plein champ, pluie comptée : ${formatNombre(plein.doseMm, 1)} mm. Dose retenue : la plus forte.` +
      sansArrosage + (sol ? ` ${sol}` : ''),
  }
}

function minuscule(phrase: string): string {
  return phrase.charAt(0).toLowerCase() + phrase.slice(1)
}
