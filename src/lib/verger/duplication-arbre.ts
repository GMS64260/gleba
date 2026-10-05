/**
 * Duplication d'un arbre, en un ou plusieurs exemplaires.
 *
 * Friction du 2026-10-03/05 : un visiteur de la démo a demandé quatre fois à
 * l'assistant « comment dupliquer un arbre depuis le plan » (la fonction
 * n'existait que pour les planches et les objets), et un compte réel a saisi
 * 52 arbres un par un, dont 6 kiwis et 9 pommiers identiques. Les copies
 * reprennent les caractéristiques de l'arbre source, mais pas ce qui est propre
 * à un individu : position GPS, circonférence, notes, historique.
 */

import { nomsCopiesEnLot } from "@/lib/jardin/noms-copie"

export const MAX_COPIES_ARBRE = 20

export interface SourcePosition {
  nom: string
  posX: number
  posY: number
  envergure: number
}

/** Noms et positions des copies : alignées à droite de la source, un pas d'envergure. */
export function planCopiesArbre(
  source: SourcePosition,
  nombre: number,
  nomsExistants: Iterable<string>,
): { nom: string; posX: number; posY: number }[] {
  const copies = Math.max(1, Math.min(Math.floor(nombre) || 1, MAX_COPIES_ARBRE))
  const noms = nomsCopiesEnLot(source.nom, nomsExistants, copies)
  const pas = Math.max(source.envergure || 0, 1) + 0.5
  return noms.map((nom, index) => ({
    nom,
    posX: Math.round((source.posX + pas * (index + 1)) * 10) / 10,
    posY: source.posY,
  }))
}
