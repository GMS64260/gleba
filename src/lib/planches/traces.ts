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
  /**
   * Années de planification (`Culture.annee`) des cultures, distinctes et
   * triées. La liste des cultures se filtre par année : sans elles, « 4
   * cultures associées » ne disait pas où les retrouver (QA cmvgdp9fn, quatre
   * cultures planifiées en 2027 sur une planche créée en 2026). Facultatif pour
   * les appelants qui construisent une valeur vide ; absent = aucune année.
   */
  anneesCultures?: number[]
  /**
   * Cultures sans année de planification (`Culture.annee` nulle) : le filtre
   * par année ne les montre pas, on les compte à part (revue du 2026-10-20).
   */
  culturesSansAnnee?: number
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
      by: ['plancheId', 'annee'],
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

  const culturesPar = new Map<string, { nombre: number; annees: Set<number>; sansAnnee: number }>()
  for (const ligne of cultures) {
    if (!ligne.plancheId) continue
    const cumul = culturesPar.get(ligne.plancheId) ?? { nombre: 0, annees: new Set<number>(), sansAnnee: 0 }
    cumul.nombre += ligne._count._all
    if (typeof ligne.annee === 'number') cumul.annees.add(ligne.annee)
    else cumul.sansAnnee += ligne._count._all
    culturesPar.set(ligne.plancheId, cumul)
  }
  const interventionsPar = new Map(interventions.map((l) => [l.plancheId, l]))

  for (const p of planches) {
    const lignes = [interventionsPar.get(p.id), p.nom !== p.id ? interventionsPar.get(p.nom) : undefined].filter(
      (l): l is NonNullable<typeof l> => l !== undefined
    )
    const annees = lignes
      .flatMap((l) => [l._min.date, l._max.date])
      .filter((d): d is Date => d instanceof Date)
      .map((d) => d.getFullYear())
    const culturesPlanche = culturesPar.get(p.id)
    traces.set(p.id, {
      cultures: culturesPlanche?.nombre ?? 0,
      interventions: lignes.reduce((total, l) => total + l._count._all, 0),
      anneesInterventions: annees.length > 0 ? [Math.min(...annees), Math.max(...annees)] : null,
      anneesCultures: [...(culturesPlanche?.annees ?? [])].sort((a, b) => a - b),
      culturesSansAnnee: culturesPlanche?.sansAnnee ?? 0,
    })
  }
  return traces
}

export function aDesTraces(traces: TracesPlanche): boolean {
  return traces.cultures > 0 || traces.interventions > 0
}

const pluriel = (n: number, singulier: string, plurielForme: string) =>
  `${n} ${n > 1 ? plurielForme : singulier}`

/**
 * « année 2027 », « années 2026 et 2027 », « années 2024, 2025 et 2027 » ;
 * au-delà de quatre années, ou pour une suite continue de plus de deux, la
 * plage « années 2019 à 2027 ». `null` sans année.
 */
export function formaterAnnees(annees: readonly number[]): string | null {
  const liste = [...new Set(annees)].sort((a, b) => a - b)
  if (liste.length === 0) return null
  if (liste.length === 1) return `année ${liste[0]}`
  const premiere = liste[0]
  const derniere = liste[liste.length - 1]
  const continue_ = derniere - premiere + 1 === liste.length
  if (liste.length > 4 || (continue_ && liste.length > 2)) return `années ${premiere} à ${derniere}`
  return `années ${liste.slice(0, -1).join(', ')} et ${derniere}`
}

/** « (année 2027) », « (années 2025 et 2027, et 1 sans année) », « (sans année) ». */
function precisionCultures(traces: TracesPlanche): string {
  const annees = formaterAnnees(traces.anneesCultures ?? [])
  const sansAnnee = traces.culturesSansAnnee ?? 0
  if (!annees) return sansAnnee > 0 ? ' (sans année)' : ''
  return sansAnnee > 0 ? ` (${annees}, et ${sansAnnee} sans année)` : ` (${annees})`
}

function anneesInterventionsTexte(traces: TracesPlanche): string | null {
  const annees = traces.anneesInterventions
  if (!annees) return null
  return annees[0] === annees[1] ? `année ${annees[0]}` : `années ${annees[0]} à ${annees[1]}`
}

/**
 * Ce qui retient la planche, en clair, avec les années où le retrouver :
 * « 4 cultures (année 2027) et 1 intervention (année 2026) ».
 */
export function decrireTraces(traces: TracesPlanche): string {
  const anneesInterventions = anneesInterventionsTexte(traces)
  const parties = [
    traces.cultures > 0
      ? `${pluriel(traces.cultures, 'culture', 'cultures')}${precisionCultures(traces)}`
      : null,
    traces.interventions > 0
      ? `${pluriel(traces.interventions, 'intervention', 'interventions')}${anneesInterventions ? ` (${anneesInterventions})` : ''}`
      : null,
  ].filter((p): p is string => p !== null)
  return parties.join(' et ')
}

/**
 * Message de refus d'une suppression, qui dit quoi faire et où chercher.
 * Seul texte du refus : la route, l'écran Planches (qui l'affiche tel quel)
 * et l'assistant (`decrireTraces`) en dépendent (QA cmvgdp9fn).
 */
export function messageSuppressionRefusee(nom: string, traces: TracesPlanche): string {
  const plusieurs = traces.cultures + traces.interventions > 1
  const quoi =
    traces.cultures > 0 && traces.interventions > 0
      ? 'ces saisies'
      : traces.cultures > 0
        ? plusieurs ? 'ces cultures' : 'cette culture'
        : plusieurs ? 'ces interventions' : 'cette intervention'
  const pronom = plusieurs ? 'les' : 'la'
  const ecrans =
    traces.cultures > 0 && traces.interventions > 0
      ? 'les écrans Cultures et Interventions'
      : traces.cultures > 0
        ? "l'écran Cultures"
        : "l'écran Interventions"
  return `La planche « ${nom} » porte encore ${decrireTraces(traces)} : supprimez ${quoi} ou rattachez-${pronom} à une autre planche depuis ${ecrans}, puis supprimez la planche.`
}

/** Lien vers la liste où retrouver ce qui retient la planche. */
export interface LienTracesPlanche {
  href: string
  libelle: string
}

/**
 * Les cultures d'abord (filtrées par planche, et par année quand il n'y en a
 * qu'une), sinon les interventions de l'année la plus récente.
 */
export function lienTracesPlanche(plancheId: string, traces: TracesPlanche): LienTracesPlanche | null {
  if (traces.cultures > 0) {
    const annees = traces.anneesCultures ?? []
    const parametres = new URLSearchParams({ planche: plancheId })
    // Filtrer sur l'année cacherait les cultures sans année.
    if (annees.length === 1 && !(traces.culturesSansAnnee ?? 0)) parametres.set('annee', String(annees[0]))
    return { href: `/maraichage/cultures?${parametres.toString()}`, libelle: 'Voir les cultures' }
  }
  if (traces.interventions > 0) {
    const annee = traces.anneesInterventions?.[1]
    return {
      href: annee ? `/interventions?annee=${annee}` : '/interventions',
      libelle: 'Voir les interventions',
    }
  }
  return null
}

/**
 * Corps du refus de suppression (409 de la route DELETE, réponse de la
 * vérification préalable de l'écran), ou `null` si rien ne retient la planche.
 */
export function refusSuppressionPlanche(
  planche: { id: string; nom: string },
  traces: TracesPlanche
): { error: string; details: TracesPlanche; lien: LienTracesPlanche | null } | null {
  if (!aDesTraces(traces)) return null
  return {
    error: messageSuppressionRefusee(planche.nom, traces),
    details: traces,
    lien: lienTracesPlanche(planche.id, traces),
  }
}
