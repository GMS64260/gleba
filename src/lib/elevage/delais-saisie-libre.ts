/**
 * Délais d'attente exigés pour un soin médicamenteux saisi sans médicament de
 * la pharmacie (pas de `produitId`, donc aucun délai AMM à reprendre).
 *
 * B6 (contre-revue 2026-11-15) — l'assistant acceptait un seul délai, même nul,
 * comme prescription : un vermifuge avec seulement « 0 jour lait » était
 * enregistré sans délai viande. Décision du Lead (traçabilité d'abord) :
 *  - le délai viande est toujours exigé (0 accepté s'il est saisi) ;
 *  - le délai lait l'est en plus pour une cible laitière ;
 *  - le délai œufs l'est en plus pour une cible pondeuse.
 *
 * Les tests d'espèce sont ceux déjà utilisés par la création de soin et la
 * traite (`estProductionLaitiere`) et par l'effectif pondeur
 * (`estEspecePondeuse`) : aucune seconde définition de « laitière » ou
 * « pondeuse ». Module pur (pas de Prisma) : l'appelant charge la cible
 * scopée par propriétaire.
 */
import { estProductionLaitiere } from '@/lib/elevage/cibles-collecte-lait'
import { estEspecePondeuse } from '@/lib/elevage/pondeuses'
import { cleTypeSoin, TYPES_SOIN_MEDICAMENTEUX } from '@/lib/elevage/types-soin'

export type DelaiAttente = 'viande' | 'lait' | 'oeufs'

export type EspeceDelaisSaisieLibre = {
  type?: string | null
  production?: string | null
  productions?: readonly string[] | null
}

export type CibleDelaisSaisieLibre = {
  especeAnimale?: EspeceDelaisSaisieLibre | null
  /** Fiche individuelle uniquement ; absent pour un lot. */
  sexe?: string | null
  orientationProduction?: string | null
}

export type DelaisSaisis = {
  tempsAttenteLaitJ?: unknown
  tempsAttenteViandeJ?: unknown
  tempsAttenteOeufsJ?: unknown
}

export const CHAMP_DELAI: Record<DelaiAttente, keyof DelaisSaisis> = {
  viande: 'tempsAttenteViandeJ',
  lait: 'tempsAttenteLaitJ',
  oeufs: 'tempsAttenteOeufsJ',
}

export const LIBELLE_DELAI: Record<DelaiAttente, string> = {
  viande: 'viande',
  lait: 'lait',
  oeufs: 'œufs',
}

/** Délais à exiger pour cette cible. Cible inconnue : viande seul (la cible est refusée ensuite). */
export function delaisRequisSaisieLibre(cible: CibleDelaisSaisieLibre | null | undefined): DelaiAttente[] {
  const requis: DelaiAttente[] = ['viande']
  if (!cible) return requis
  const espece = cible.especeAnimale ?? null
  // Un mâle ne se trait pas et ne pond pas ; un sexe inconnu garde l'exigence.
  const male = cible.sexe === 'male'
  if (!male && estProductionLaitiere(espece, cible.orientationProduction)) requis.push('lait')
  const productions = [espece?.production, ...(espece?.productions ?? [])]
  if (!male && productions.some((p) => estEspecePondeuse(p, espece?.type))) requis.push('oeufs')
  return requis
}

/** Un délai est saisi s'il vaut un nombre (0 compris) ; null, absent ou chaîne vide = non saisi. */
export function delaiSaisi(valeur: unknown): boolean {
  if (valeur === undefined || valeur === null) return false
  if (typeof valeur === 'string') return valeur.trim() !== ''
  return true
}

export function delaisManquantsSaisieLibre(requis: readonly DelaiAttente[], saisis: DelaisSaisis): DelaiAttente[] {
  return requis.filter((d) => !delaiSaisi(saisis[CHAMP_DELAI[d]]))
}

export const CODE_DELAIS_ATTENTE_REQUIS = 'DELAIS_ATTENTE_REQUIS' as const

export type RefusDelaisAttente = {
  status: 422
  error: string
  code: typeof CODE_DELAIS_ATTENTE_REQUIS
  delaisManquants: DelaiAttente[]
}

/**
 * Le soin relève-t-il de la règle ? Soin médicamenteux (type repliée par
 * `cleTypeSoin` : un ancien « vermifuge » en minuscules compte) sans
 * médicament de la pharmacie. Avec un `produitId`, les délais viennent de
 * l'AMM du produit.
 */
export function soinSaisieLibreMedicamenteux(soin: { type: string | null | undefined; produitId?: string | null }): boolean {
  return TYPES_SOIN_MEDICAMENTEUX.has(cleTypeSoin(soin.type)) && !soin.produitId
}

/**
 * Règle unique des délais d'un soin médicamenteux en saisie libre, au moment
 * où il devient administré : à la création d'un soin fait (`creation`) et à
 * chaque passage d'un soin planifié à « fait » (`validation` : PATCH du soin,
 * injection réalisée, assistant). Même corps de message ; seule la dernière
 * phrase dit ce qui n'a pas été écrit. `null` = rien à refuser.
 */
export function refusDelaisSaisieLibre(
  soin: { type: string | null | undefined; produitId?: string | null },
  cible: CibleDelaisSaisieLibre | null | undefined,
  saisis: DelaisSaisis,
  contexte: 'creation' | 'validation',
): RefusDelaisAttente | null {
  if (!soinSaisieLibreMedicamenteux(soin)) return null
  const manquants = delaisManquantsSaisieLibre(delaisRequisSaisieLibre(cible), saisis)
  if (manquants.length === 0) return null
  const liste = manquants.map((delai) => LIBELLE_DELAI[delai]).join(', ')
  const fin = contexte === 'creation'
    ? 'Aucun soin n’a été enregistré.'
    : 'Le soin reste à faire : rien n’a été enregistré.'
  return {
    status: 422,
    error: `Délai d’attente ${liste} manquant : un soin « ${cleTypeSoin(soin.type)} » administré sans médicament de la pharmacie exige les délais d’attente ${liste} prescrits par le vétérinaire (0 seulement s’il l’a prescrit). ${fin}`,
    code: CODE_DELAIS_ATTENTE_REQUIS,
    delaisManquants: manquants,
  }
}
