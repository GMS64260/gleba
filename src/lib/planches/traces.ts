/**
 * Traces qu'une planche porte encore, et qui interdisent de la supprimer.
 *
 * QA cmv29i9ad (2026-10-10) : supprimer une planche ne regardait que ses
 * cultures. Une intervention saisie sur la planche survivait, sa colonne
 * `planche_id` (sans clé étrangère) pointant vers une planche disparue, et la
 * liste affichait l'identifiant brut ; le registre phyto perdait l'emplacement
 * du traitement. Les fertilisations, elles, partaient en cascade
 * (`onDelete: Cascade`) sans un mot.
 *
 * Règle : une planche se supprime seulement si plus rien ne s'y rapporte
 * (cultures, interventions, fertilisations). Toute suppression passe par cette
 * fonction : route, conversion en objet du plan, assistant.
 */

import type { Prisma, PrismaClient } from '@prisma/client'

type Tx = Prisma.TransactionClient | PrismaClient

export interface TracesPlanche {
  cultures: number
  interventions: number
  fertilisations: number
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

  const [cultures, fertilisations, interventions] = await Promise.all([
    // Cultures et fertilisations sont liées par clé étrangère à une planche déjà
    // vérifiée comme appartenant au compte : on les compte toutes.
    tx.culture.groupBy({
      by: ['plancheId'],
      where: { plancheId: { in: ids } },
      _count: { _all: true },
    }),
    tx.fertilisation.groupBy({
      by: ['plancheId'],
      where: { plancheId: { in: ids } },
      _count: { _all: true },
    }),
    // Colonne sans clé étrangère, qui a porté des noms : bornée au compte.
    tx.intervention.groupBy({
      by: ['plancheId'],
      where: { userId, plancheId: { in: references } },
      _count: { _all: true },
    }),
  ])

  const parReference = (lignes: Array<{ plancheId: string | null; _count: { _all: number } }>) =>
    new Map(lignes.map((l) => [l.plancheId, l._count._all]))
  const culturesPar = parReference(cultures)
  const fertilisationsPar = parReference(fertilisations)
  const interventionsPar = parReference(interventions)

  for (const p of planches) {
    traces.set(p.id, {
      cultures: culturesPar.get(p.id) ?? 0,
      fertilisations: fertilisationsPar.get(p.id) ?? 0,
      interventions: (interventionsPar.get(p.id) ?? 0) + (p.nom !== p.id ? interventionsPar.get(p.nom) ?? 0 : 0),
    })
  }
  return traces
}

export function aDesTraces(traces: TracesPlanche): boolean {
  return traces.cultures > 0 || traces.interventions > 0 || traces.fertilisations > 0
}

const pluriel = (n: number, singulier: string, plurielForme: string) =>
  `${n} ${n > 1 ? plurielForme : singulier}`

/** Ce qui retient la planche, en clair : « 2 cultures et 1 intervention ». */
export function decrireTraces(traces: TracesPlanche): string {
  const parties = [
    traces.cultures > 0 ? pluriel(traces.cultures, 'culture', 'cultures') : null,
    traces.interventions > 0 ? pluriel(traces.interventions, 'intervention', 'interventions') : null,
    traces.fertilisations > 0 ? pluriel(traces.fertilisations, 'fertilisation', 'fertilisations') : null,
  ].filter((p): p is string => p !== null)
  if (parties.length <= 1) return parties[0] ?? ''
  return `${parties.slice(0, -1).join(', ')} et ${parties[parties.length - 1]}`
}

/** Message de refus d'une suppression, qui dit quoi faire. */
export function messageSuppressionRefusee(nom: string, traces: TracesPlanche): string {
  // Culture, intervention, fertilisation : trois féminins.
  const plusieurs = traces.cultures + traces.interventions + traces.fertilisations > 1
  const pronom = plusieurs ? 'les' : 'la'
  return `La planche « ${nom} » porte encore ${decrireTraces(traces)} : supprimez-${pronom} ou rattachez-${pronom} à une autre planche avant de la supprimer, pour ne pas perdre ${plusieurs ? 'leur' : 'son'} emplacement.`
}
