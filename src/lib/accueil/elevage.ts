/**
 * Accueil v2 — lecture des échéances d'élevage (`chargerAgendaElevage`) :
 * lesquelles entrent dans la liste du jour, avec quel état de registre et
 * vers quel écran. Fonctions PURES, partagées entre la composition serveur
 * et la tuile Élevage.
 */

import type { EcheanceElevage } from "@/lib/elevage/agenda.server"
import type { EtatRegistre } from "@/components/accueil/PastilleEtat"

/** Où mène une échéance d'élevage, par nature. */
export const HREF_ECHEANCE: Partial<Record<EcheanceElevage["kind"], string>> = {
  mise_bas: "/elevage?tab=reproduction",
  fenetre_mise_bas: "/elevage?tab=reproduction",
  tarissement: "/elevage?tab=reproduction",
  diagnostic_gestation: "/elevage?tab=reproduction",
  attente_lait: "/elevage?tab=animaux",
  attente_oeufs: "/elevage?tab=animaux",
  attente_viande: "/elevage?tab=animaux",
  soin_planifie: "/elevage?tab=alimentation&sub=soins",
  soin_retard: "/elevage?tab=alimentation&sub=soins",
  stock_aliment: "/elevage?tab=alimentation&sub=stocks",
  medicament_peremption: "/elevage?tab=alimentation&sub=registre",
  prophylaxie: "/elevage?tab=alimentation&sub=registre",
  tache_terrain: "/elevage?tab=calendrier",
  administratif: "/elevage?tab=calendrier",
}
export const HREF_ECHEANCE_DEFAUT = "/elevage?tab=calendrier"

export function hrefEcheance(e: Pick<EcheanceElevage, "kind" | "action">): string {
  return e.action?.href ?? HREF_ECHEANCE[e.kind] ?? HREF_ECHEANCE_DEFAUT
}

/** Une échéance d'élevage a-t-elle sa place dans la liste du jour ? */
export function echeanceDuJour(e: Pick<EcheanceElevage, "gravite" | "joursRestants">): boolean {
  return e.gravite === "urgent" || (e.joursRestants !== null && e.joursRestants <= 0)
}

/**
 * État de registre d'une échéance : la gravité de l'agenda n'est pas un verbe
 * d'action. Un délai d'attente (lait, œufs, viande) est une contrainte à
 * connaître, pas une tâche en retard.
 */
export function etatEcheance(e: Pick<EcheanceElevage, "gravite" | "joursRestants" | "kind">): EtatRegistre {
  const retard = e.joursRestants !== null && e.joursRestants < 0
  if (retard) return e.gravite === "urgent" ? "critique" : "attention"
  if (e.kind === "attente_lait" || e.kind === "attente_oeufs" || e.kind === "attente_viande") return "info"
  if (e.gravite === "urgent" || e.gravite === "attention") return "attention"
  return "info"
}
