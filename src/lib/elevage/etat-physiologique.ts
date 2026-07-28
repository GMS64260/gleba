/**
 * État physiologique d'une femelle (PROMPT 24, partie dérivée — 0 migration).
 *
 * Déduit l'état de conduite à partir des mises-bas, des saillies gestantes et
 * de la dernière collecte de lait. Permet de trier le troupeau (taries vs en
 * lactation vs gestantes) sans nouvelle colonne.
 */

export type EtatPhysio =
  | 'nullipare' // n'a jamais mis bas, ni gestante ni traite
  | 'gestante' // gestante n'ayant jamais mis bas (chevrette de renouvellement)
  | 'lactation' // trait, non gestante
  | 'lactation_gestante' // trait ET gestante (chèvre relactée)
  | 'gestante_tarie' // gestante et non traite (tarie avant mise-bas)
  | 'vide' // a déjà mis bas, ni gestante ni traite

/**
 * QA caprin cms1vgm9n — « nullipare » et « gestante » ne sont pas exclusifs :
 * une chevrette gestante de sa 1ʳᵉ mise-bas est les deux à la fois. L'état du
 * CYCLE (gestante / lactation / tarie / vide) prime pour la conduite ; la
 * PARITÉ (nullipare / primipare / multipare) est une dimension séparée.
 */
export type Parite = 'nullipare' | 'primipare' | 'multipare'

export type ContexteFemelle = {
  aMisBas: boolean
  gestante: boolean // saillie 'Gestante' postérieure à la dernière mise-bas
  derniereCollecte: Date | string | null
}

export const LABELS_ETAT: Record<EtatPhysio, string> = {
  nullipare: 'Nullipare',
  gestante: 'Gestante',
  lactation: 'En lactation',
  lactation_gestante: 'Lactation + gestante',
  gestante_tarie: 'Tarie (gestante)',
  vide: 'Vide',
}

export const LABELS_PARITE: Record<Parite, string> = {
  nullipare: 'Nullipares',
  primipare: 'Primipares',
  multipare: 'Multipares',
}

/** Fenêtre (jours) sous laquelle une collecte récente signifie « en lactation ». */
export const JOURS_LACTATION_ACTIVE = 10

export function etatPhysiologique(ctx: ContexteFemelle, refDate: Date = new Date()): EtatPhysio {
  const enLactation =
    ctx.derniereCollecte != null &&
    (refDate.getTime() - new Date(ctx.derniereCollecte).getTime()) / 86_400_000 <= JOURS_LACTATION_ACTIVE

  // La gestation et la lactation priment : une chevrette gestante ne doit
  // JAMAIS s'afficher « Nullipare »/« Vide » — on risquerait de la remettre
  // en lutte alors qu'elle est déjà pleine (QA caprin cms1vgm9n).
  if (enLactation) return ctx.gestante ? 'lactation_gestante' : 'lactation'
  if (ctx.gestante) return ctx.aMisBas ? 'gestante_tarie' : 'gestante'
  if (!ctx.aMisBas) return 'nullipare'
  return 'vide'
}

export function pariteFemelle(nbMisesBas: number): Parite {
  if (nbMisesBas <= 0) return 'nullipare'
  if (nbMisesBas === 1) return 'primipare'
  return 'multipare'
}
