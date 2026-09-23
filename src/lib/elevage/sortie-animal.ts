/**
 * Cohérence du statut d'un animal avec ses champs de sortie, et présence
 * d'une mère à la date d'une naissance.
 *
 * Ticket cmud1e386007mujsckl8uz4ci (2026-09-22) — un éleveur caprin voulait
 * saisir des chevreaux oubliés d'une chèvre déclarée morte : elle n'était plus
 * proposée comme mère (sélecteurs limités aux animaux actifs). Pour s'en
 * sortir, il l'a fait remettre « actif » par l'assistant, qui a gardé sa date
 * de sortie : un animal actif sorti le 15/03. Deux règles en découlent :
 *  - une femelle sortie reste une mère possible pour une naissance ANTÉRIEURE
 *    (ou du jour même) à sa sortie, jamais postérieure ;
 *  - un animal remis « actif » n'a plus de date, cause ni motif de sortie.
 */

export const STATUT_ACTIF = 'actif'

/** Champs effacés quand un animal redevient actif (vente/mort/abattage annulés). */
export const CHAMPS_SORTIE = ['dateSortie', 'causeSortie', 'motifSortie', 'nExploitationDestination'] as const

export type ChampSortie = (typeof CHAMPS_SORTIE)[number]

/**
 * Champs de sortie à forcer à null pour un statut cible : un animal actif ne
 * peut pas porter de sortie. Retourne {} si le statut n'est pas « actif » ou
 * n'est pas modifié.
 */
export function effacementSortieSiActif(statutCible: unknown): Partial<Record<ChampSortie, null>> {
  if (statutCible !== STATUT_ACTIF) return {}
  return Object.fromEntries(CHAMPS_SORTIE.map((champ) => [champ, null])) as Record<ChampSortie, null>
}

/** Jour civil UTC (AAAA-MM-JJ) : les dates de l'élevage sont saisies au jour. */
function jour(d: Date | string): string {
  return (typeof d === 'string' ? new Date(d) : d).toISOString().slice(0, 10)
}

export interface MereSortieInfo {
  statut: string
  dateSortie?: Date | string | null
}

/**
 * La mère était-elle encore dans le cheptel à la date de mise bas ?
 * Vrai si elle est active, si sa date de sortie ou la date de mise bas est
 * inconnue (ne pas exclure à tort), ou si la mise bas est au plus tard le
 * jour de la sortie (une chèvre peut mourir en mettant bas).
 */
export function merePresenteALaNaissance(mere: MereSortieInfo, dateMiseBas: Date | string | null): boolean {
  if (mere.statut === STATUT_ACTIF || !mere.dateSortie || !dateMiseBas) return true
  const naissance = typeof dateMiseBas === 'string' ? new Date(dateMiseBas) : dateMiseBas
  if (Number.isNaN(naissance.getTime())) return true
  return jour(naissance) <= jour(mere.dateSortie)
}

const LIBELLE_SORTIE: Record<string, string> = {
  mort: 'morte',
  abattu: 'abattue',
  vendu: 'vendue',
}

/** Message d'erreur si la naissance est postérieure à la sortie de la mère, sinon null. */
export function erreurMereSortieAvantNaissance(
  mere: MereSortieInfo,
  dateMiseBas: Date | string | null,
): string | null {
  if (merePresenteALaNaissance(mere, dateMiseBas)) return null
  const fr = (d: Date | string) => jour(d).split('-').reverse().join('/')
  const etat = LIBELLE_SORTIE[mere.statut] ?? 'sortie du cheptel'
  return `Filiation impossible : la mère proposée est ${etat} le ${fr(mere.dateSortie!)}, avant cette naissance (${fr(dateMiseBas!)})`
}
