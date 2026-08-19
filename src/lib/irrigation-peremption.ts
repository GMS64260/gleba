/**
 * Péremption des irrigations planifiées.
 *
 * Un arrosage est une tâche PÉRISSABLE : il ne se rattrape pas. Le plan est
 * pourtant généré une fois pour toute la saison (`irrigation-scheduler.ts`,
 * jusqu'à 45 passages par culture), si bien que chaque passage manqué restait
 * dû indéfiniment et s'accumulait.
 *
 * Friction mesurée le 2026-08-14 sur un maraîcher quotidien : son briefing
 * annonçait « 20 actions, 19 en retard, échéance 09/08 », soldées en dix
 * secondes par huit tapes (une par planche). Ce clic estampillait du 14/08
 * trente lignes prévues les 08, 09, 10, 11, 12 et 13 : le compteur de retard
 * n'informait de rien, et le registre d'interventions affirmait des arrosages
 * qui n'avaient pas eu lieu.
 *
 * Règle retenue : passé UN cycle d'arrosage complet, un passage manqué est
 * abandonné. Il n'est plus dû, ne compte plus comme retard, et ne peut plus
 * être clos comme s'il avait été réalisé.
 *
 * Le calcul est fait EN MÉMOIRE à chaque lecture, la persistance n'étant
 * qu'une trace : écran et assistant comptent donc pareil, que le balayage
 * ait déjà tourné ou non (invariant « 11 = 11 », cf. [[Technique]]).
 */

import prisma from '@/lib/prisma'

/**
 * Cadence d'arrosage en jours, dérivée du besoin en eau de l'espèce.
 * Seule définition de la cadence : `irrigation-scheduler.ts` la partage pour
 * que le plan et sa péremption ne puissent pas diverger.
 */
export function frequenceIrrigationJours(besoinEau: number | null | undefined): number {
  const besoin = besoinEau ?? 3
  // Gourmand = tous les 2 j, moyen = 3 j, faible = 5 j.
  return besoin >= 4 ? 2 : besoin >= 3 ? 3 : 5
}

/** Cycle le plus long : borne les lectures du balayage. */
export const CYCLE_MAX_JOURS = 5

/**
 * Journée civile LOCALE, même convention que `joursRetard` (taches-potager)
 * et que le widget lunaire. Le conteneur tourne en Europe/Paris : comparer
 * des instants ferait basculer d'un jour juste après minuit.
 */
function jourCivil(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Jours civils de retard d'une échéance sur la date de référence. */
export function joursDeRetard(datePrevue: Date, reference: Date): number {
  return Math.round((jourCivil(reference) - jourCivil(datePrevue)) / 86_400_000)
}

/**
 * Un passage manqué de plus d'un cycle complet est périmé.
 * Strictement supérieur : une tomate (cycle 2 j) manquée avant-hier reste
 * rattrapable aujourd'hui, celle d'il y a trois jours ne l'est plus.
 */
export function estPerimee(
  datePrevue: Date,
  besoinEau: number | null | undefined,
  reference: Date = new Date()
): boolean {
  return joursDeRetard(datePrevue, reference) > frequenceIrrigationJours(besoinEau)
}

/**
 * Borne basse de lecture des irrigations encore dues.
 *
 * Au-delà du cycle le plus long, tout passage manqué est abandonné quelle que
 * soit l'espèce : inutile de charger plus loin. Indispensable dès qu'une
 * lecture est plafonnée par un `take` — sinon les lignes les plus ANCIENNES,
 * toutes périmées, évincent les passages réellement dus. Constaté en
 * vérification de bascule le 2026-08-14 : un compte à 1 018 passages
 * abandonnés voyait « 0 irrigation » au briefing alors qu'il en avait 10.
 *
 * `plancher` reste respecté (date de création du compte, anti-retards
 * antérieurs à l'inscription) : on retient la borne la plus tardive.
 */
export function borneLectureIrrigation(jourCourant: Date, plancher: Date): Date {
  const borne = new Date(jourCourant)
  borne.setDate(borne.getDate() - CYCLE_MAX_JOURS)
  // Ramenée au DÉBUT de la journée : la péremption se compte en journées
  // civiles, donc la journée limite doit être couverte en entier. Garder
  // l'heure du jour courant amputerait les passages du matin de ce jour-là.
  borne.setHours(0, 0, 0, 0)
  return borne > plancher ? borne : plancher
}

/** Forme minimale attendue d'une irrigation lue pour être jugée périmable. */
export interface IrrigationPerimable {
  id: number
  datePrevue: Date
  fait: boolean
  perimee: boolean
  culture: { espece: { besoinEau: number | null } | null } | null
}

/**
 * Identifiants des irrigations encore dues en base mais périmées à la lecture.
 * Ne touche ni aux passages faits, ni à ceux déjà marqués périmés.
 */
export function idsAExpirer(
  irrigations: readonly IrrigationPerimable[],
  reference: Date = new Date()
): number[] {
  return irrigations
    .filter((irr) => !irr.fait && !irr.perimee)
    .filter((irr) => estPerimee(irr.datePrevue, irr.culture?.espece?.besoinEau, reference))
    .map((irr) => irr.id)
}

/**
 * Marque en base les passages manqués depuis plus d'un cycle.
 * Idempotent : réservé aux chemins écran, les chemins de lecture pure
 * (assistant, rejeu de questions) appliquent la même règle en mémoire.
 */
export async function expirerIrrigationsPerimees(
  userId: string,
  reference: Date = new Date()
): Promise<number> {
  const borne = new Date(reference)
  borne.setHours(0, 0, 0, 0)
  borne.setDate(borne.getDate() - CYCLE_MAX_JOURS)

  const candidates = await prisma.irrigationPlanifiee.findMany({
    where: { userId, fait: false, perimee: false, datePrevue: { lt: borne } },
    select: {
      id: true,
      datePrevue: true,
      fait: true,
      perimee: true,
      culture: { select: { espece: { select: { besoinEau: true } } } },
    },
  })

  const ids = idsAExpirer(candidates, reference)
  if (ids.length === 0) return 0

  const { count } = await prisma.irrigationPlanifiee.updateMany({
    where: { id: { in: ids } },
    data: { perimee: true },
  })
  return count
}
