/**
 * Statut d'une opération d'entretien verger, source unique pour tous les
 * consommateurs (onglet Calendrier, onglet Opérations, tâches de la semaine,
 * briefing quotidien de l'assistant).
 *
 * Né du constat de production du 2026-08-03 : chaque écran recalculait « en
 * retard » avec sa propre règle (`datePrevue < today`), ce qui étiquetait « 48
 * jours de retard » une taille en vert dont la fenêtre juin-juillet était
 * simplement refermée. Une fenêtre fermée n'est pas un retard : c'est un
 * rendez-vous manqué pour la saison, qui reviendra l'an prochain.
 *
 * Règle : un retard n'existe que face à une échéance FERME (`dateLimite` null,
 * c'est-à-dire une saisie manuelle où l'utilisateur a choisi une date). Une
 * opération générée porte une fenêtre ; elle est à faire pendant, dépassée
 * après, jamais « en retard ».
 */

export type StatutOperationArbre =
  | "faite"
  | "soldee"
  | "a_faire"
  | "a_venir"
  | "en_retard"
  | "fenetre_depassee"

export interface OperationArbreStatutInput {
  fait: boolean
  datePrevue: Date | string | null
  dateLimite?: Date | string | null
  abandonneeLe?: Date | string | null
}

/** Minuit local : une opération conseillée aujourd'hui n'est ni en retard ni à venir. */
export function debutDeJour(reference: Date = new Date()): Date {
  const jour = new Date(reference)
  jour.setHours(0, 0, 0, 0)
  return jour
}

function versDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function statutOperationArbre(
  operation: OperationArbreStatutInput,
  aujourdhui: Date = debutDeJour()
): StatutOperationArbre {
  if (operation.fait) return "faite"
  if (versDate(operation.abandonneeLe)) return "soldee"

  const limite = versDate(operation.dateLimite)
  if (limite && limite < aujourdhui) return "fenetre_depassee"

  const prevue = versDate(operation.datePrevue)
  if (prevue && prevue > aujourdhui) return "a_venir"

  // Fenêtre encore ouverte : faisable, quel que soit l'âge de la date conseillée.
  if (limite) return "a_faire"

  // Échéance ferme dépassée : c'est un vrai retard, à remonter tel quel. Un
  // rappel volontairement antidaté par l'utilisateur est un signal, pas du bruit.
  if (prevue && prevue < aujourdhui) return "en_retard"

  return "a_faire"
}

/** Les statuts qui demandent une action aujourd'hui. */
export function estActionnable(statut: StatutOperationArbre): boolean {
  return statut === "a_faire" || statut === "en_retard"
}

/**
 * Libellé court d'une opération : le générateur stocke
 * `"Taille en vert — Pincement des pousses vigoureuses"`. Le libellé seul est
 * la clé de regroupement naturelle (79 arbres, une ligne), le reste est le
 * détail agronomique.
 */
export function libelleCourtOperation(description: string | null): string {
  if (!description) return "Opération"
  const [libelle] = description.split(" — ")
  return libelle.trim() || description.trim()
}

const MOIS_COURTS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

/**
 * « juin-juillet », « septembre » : la fenêtre telle qu'un arboriculteur la
 * nomme, plutôt qu'un couple de dates que personne ne lit.
 */
export function libelleFenetre(
  debut: Date | string | null | undefined,
  fin: Date | string | null | undefined
): string | null {
  const d = versDate(debut)
  const f = versDate(fin)
  if (!d || !f) return null
  const moisDebut = MOIS_COURTS[d.getMonth()]
  const moisFin = MOIS_COURTS[f.getMonth()]
  return moisDebut === moisFin ? moisDebut : `${moisDebut}-${moisFin}`
}
