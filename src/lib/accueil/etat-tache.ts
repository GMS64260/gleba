/**
 * État d'une tâche de culture ou d'un arrosage planifié, exprimé en verbe,
 * pour la ligne de registre (charte « carnet de ferme », P4 « une liste est
 * un registre », 2026-10-09). Pur : partagé par la page Tâches, l'onglet
 * Calendrier et, demain, les autres listes du jour.
 *
 * Règles : la couleur ne porte jamais seule l'information, le libellé dit ce
 * qu'il reste à faire (« À semer ») ou ce qui a été fait (« Semé ») ; un
 * retard d'une semaine ou plus est critique, un retard plus court demande
 * attention.
 */
import type { EtatRegistre } from "@/components/accueil/PastilleEtat"

export type TypeTache = "semis" | "plantation" | "recolte"

export interface EtatLigne {
  etat: EtatRegistre
  libelle: string
}

const SEUIL_CRITIQUE_JOURS = 7

const VERBES: Record<TypeTache, { aFaire: string; fait: string }> = {
  semis: { aFaire: "À semer", fait: "Semé" },
  plantation: { aFaire: "À planter", fait: "Planté" },
  recolte: { aFaire: "À récolter", fait: "Récolté" },
}

/** « 3 j de retard », « 1 sem. de retard », « 2 sem. de retard » ; vide sans retard. */
export function libelleRetard(jours: number): string {
  if (!Number.isFinite(jours) || jours <= 0) return ""
  const semaines = Math.floor(jours / 7)
  if (semaines < 1) return `${jours} j de retard`
  return `${semaines} sem. de retard`
}

function etatRetard(jours: number): EtatRegistre {
  return jours >= SEUIL_CRITIQUE_JOURS ? "critique" : "attention"
}

export function etatTache(tache: { type: TypeTache; fait: boolean; retardJours?: number | null }): EtatLigne {
  const verbes = VERBES[tache.type]
  if (tache.fait) return { etat: "ok", libelle: verbes.fait }
  const retard = tache.retardJours ?? 0
  if (retard > 0) return { etat: etatRetard(retard), libelle: "En retard" }
  return { etat: "neutre", libelle: verbes.aFaire }
}

/**
 * Libellé du bouton d'action d'une tâche : « Fait » solde la ligne d'un
 * geste, « Noter » ouvre la saisie de quantité d'une récolte, « Annuler »
 * revient en arrière.
 */
export function libelleActionTache(type: TypeTache, fait: boolean): "Fait" | "Noter" | "Annuler" {
  if (fait) return "Annuler"
  return type === "recolte" ? "Noter" : "Fait"
}

export function etatIrrigation(arrosage: {
  fait?: boolean
  retardJours?: number | null
  probablementInutile?: boolean
  datePrevue: string | Date
  maintenant?: Date
}): EtatLigne {
  if (arrosage.fait) return { etat: "ok", libelle: "Arrosé" }
  const retard = arrosage.retardJours ?? 0
  if (retard > 0) return { etat: etatRetard(retard), libelle: "En retard" }
  if (arrosage.probablementInutile) return { etat: "info", libelle: "Pluie prévue" }
  const maintenant = arrosage.maintenant ?? new Date()
  const prevue = new Date(arrosage.datePrevue)
  if (prevue.toDateString() === maintenant.toDateString()) return { etat: "attention", libelle: "À arroser" }
  return { etat: "neutre", libelle: "Prévu" }
}

/** « Aujourd'hui », sinon « jeu. 10 ». */
export function libelleDatePrevue(date: string | Date, maintenant: Date = new Date()): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ""
  if (d.toDateString() === maintenant.toDateString()) return "Aujourd'hui"
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })
}
