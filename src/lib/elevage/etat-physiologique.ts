/**
 * État physiologique d'une femelle (PROMPT 24, partie dérivée — 0 migration).
 *
 * Déduit l'état de conduite à partir des mises-bas, des saillies gestantes et
 * de la dernière collecte de lait. Permet de trier le troupeau (taries vs en
 * lactation vs gestantes) sans nouvelle colonne.
 */

export type EtatPhysio =
  | 'nullipare' // n'a jamais mis bas
  | 'lactation' // trait, non gestante
  | 'lactation_gestante' // trait ET gestante (chèvre relactée)
  | 'gestante_tarie' // gestante et non traite (tarie avant mise-bas)
  | 'vide' // a déjà mis bas, ni gestante ni traite

export type ContexteFemelle = {
  aMisBas: boolean
  gestante: boolean // saillie 'Gestante' postérieure à la dernière mise-bas
  derniereCollecte: Date | string | null
}

export const LABELS_ETAT: Record<EtatPhysio, string> = {
  nullipare: 'Nullipare',
  lactation: 'En lactation',
  lactation_gestante: 'Lactation + gestante',
  gestante_tarie: 'Tarie (gestante)',
  vide: 'Vide',
}

/** Fenêtre (jours) sous laquelle une collecte récente signifie « en lactation ». */
export const JOURS_LACTATION_ACTIVE = 10

export function etatPhysiologique(ctx: ContexteFemelle, refDate: Date = new Date()): EtatPhysio {
  const enLactation =
    ctx.derniereCollecte != null &&
    (refDate.getTime() - new Date(ctx.derniereCollecte).getTime()) / 86_400_000 <= JOURS_LACTATION_ACTIVE

  if (!ctx.aMisBas) return 'nullipare'
  if (enLactation) return ctx.gestante ? 'lactation_gestante' : 'lactation'
  if (ctx.gestante) return 'gestante_tarie'
  return 'vide'
}
