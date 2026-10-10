/**
 * Traces qu'une planche porte encore, et qui interdisent de la supprimer.
 *
 * QA cmv29i9ad (2026-10-10) : supprimer une planche ne regardait que ses
 * cultures. Une intervention saisie sur la planche survivait, sa colonne
 * `planche_id` (sans clé étrangère) pointant vers une planche disparue, et la
 * liste affichait l'identifiant brut ; le registre phyto perdait l'emplacement
 * du traitement.
 *
 * Règle : une planche se supprime seulement si aucune culture ni intervention
 * ne s'y rapporte, deux saisies que l'utilisateur peut supprimer ou rattacher
 * à une autre planche depuis l'interface. Toute suppression passe par cette
 * fonction : route, conversion en objet du plan, assistant.
 *
 * Ne retiennent PAS la planche, volontairement :
 * - les fertilisations (`onDelete: Cascade`) : elles ne viennent que de
 *   l'import Potaléger et aucun écran ne les supprime ni ne les déplace ; les
 *   exiger rendait la planche indestructible. L'écran Planches annonce leur
 *   suppression à la confirmation.
 * - les analyses de sol (`onDelete: SetNull`) : elles survivent, détachées.
 */

import type { Prisma, PrismaClient } from '@prisma/client'

type Tx = Prisma.TransactionClient | PrismaClient

export interface TracesPlanche {
  cultures: number
  interventions: number
  /**
   * Années de la plus ancienne et de la plus récente intervention : la liste
   * des interventions est filtrée par année, celle d'une saison passée ne s'y
   * voit pas sans changer l'année.
   */
  anneesInterventions: [number, number] | null
}

/**
 * Compte les traces de chaque planche du compte. `Intervention.plancheId`
 * a porté le nom de la planche avant d'en porter l'id : les deux sont comptés,
 * comme la liste des interventions et le registre phyto les résolvent.
 */
export async function compterTracesPlanches(
  tx: Tx,
  planches: Array<{ id: string; nom: string }>,
  userId: string
): Promise<Map<string, TracesPlanche>> {
  const traces = new Map<string, TracesPlanche>()
  if (planches.length === 0) return traces
  const ids = planches.map((p) => p.id)
  const references = [...new Set(planches.flatMap((p) => [p.id, p.nom]))]

  const [cultures, interventions] = await Promise.all([
    // Cultures liées par clé étrangère à une planche déjà vérifiée comme
    // appartenant au compte : on les compte toutes.
    tx.culture.groupBy({
      by: ['plancheId'],
      where: { plancheId: { in: ids } },
      _count: { _all: true },
    }),
    // Colonne sans clé étrangère, qui a porté des noms : bornée au compte.
    tx.intervention.groupBy({
      by: ['plancheId'],
      where: { userId, plancheId: { in: references } },
      _count: { _all: true },
      _min: { date: true },
      _max: { date: true },
    }),
  ])

  const culturesPar = new Map(cultures.map((l) => [l.plancheId, l._count._all]))
  const interventionsPar = new Map(interventions.map((l) => [l.plancheId, l]))

  for (const p of planches) {
    const lignes = [interventionsPar.get(p.id), p.nom !== p.id ? interventionsPar.get(p.nom) : undefined].filter(
      (l): l is NonNullable<typeof l> => l !== undefined
    )
    const annees = lignes
      .flatMap((l) => [l._min.date, l._max.date])
      .filter((d): d is Date => d instanceof Date)
      .map((d) => d.getFullYear())
    traces.set(p.id, {
      cultures: culturesPar.get(p.id) ?? 0,
      interventions: lignes.reduce((total, l) => total + l._count._all, 0),
      anneesInterventions: annees.length > 0 ? [Math.min(...annees), Math.max(...annees)] : null,
    })
  }
  return traces
}

export function aDesTraces(traces: TracesPlanche): boolean {
  return traces.cultures > 0 || traces.interventions > 0
}

const pluriel = (n: number, singulier: string, plurielForme: string) =>
  `${n} ${n > 1 ? plurielForme : singulier}`

/** Ce qui retient la planche, en clair : « 2 cultures et 1 intervention ». */
export function decrireTraces(traces: TracesPlanche): string {
  const parties = [
    traces.cultures > 0 ? pluriel(traces.cultures, 'culture', 'cultures') : null,
    traces.interventions > 0 ? pluriel(traces.interventions, 'intervention', 'interventions') : null,
  ].filter((p): p is string => p !== null)
  return parties.join(' et ')
}

/** Message de refus d'une suppression, qui dit quoi faire et où chercher. */
export function messageSuppressionRefusee(nom: string, traces: TracesPlanche): string {
  const plusieurs = traces.cultures + traces.interventions > 1
  const quoi = plusieurs ? 'ces saisies' : traces.cultures > 0 ? 'cette culture' : 'cette intervention'
  const pronom = plusieurs ? 'les' : 'la'
  const annees = traces.anneesInterventions
  const ou = annees
    ? ` (Interventions, ${annees[0] === annees[1] ? `année ${annees[0]}` : `années ${annees[0]} à ${annees[1]}`})`
    : ''
  return `La planche « ${nom} » porte encore ${decrireTraces(traces)} : supprimez ${quoi} ou rattachez-${pronom} à une autre planche${ou}, puis supprimez la planche.`
}
