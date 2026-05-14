/**
 * Utilitaires reproduction (PROMPT 18).
 *
 * - Calcul date mise-bas attendue à partir de la durée gestation de l'espèce
 * - Calcul date tarissement (caprin/bovin : ~60 j avant mise-bas)
 * - Détection consanguinité par parcours ancestral
 */

import type { PrismaClient } from '@prisma/client'

type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

/** Durées de gestation par défaut si l'espèce ne les renseigne pas (FR). */
export const DUREE_GESTATION_DEFAUTS: Record<string, number> = {
  brebis: 150,
  chevre: 150,
  caprin: 150,
  ovin: 150,
  truie: 114,
  cochon: 114,
  porcin: 114,
  vache: 280,
  bovin: 280,
  jument: 330,
  equin: 330,
  cheval: 330,
  lapin: 31,
  // Volailles : couvaison
  poule: 21,
  cane: 28,
  oie: 30,
  caille: 17,
  dinde: 28,
  pintade: 27,
}

/** Calcule date mise-bas attendue selon durée gestation espèce. */
export function dateMiseBasAttendue(dateSaillie: Date, dureeGestationJours: number): Date {
  const d = new Date(dateSaillie)
  d.setUTCDate(d.getUTCDate() + dureeGestationJours)
  return d
}

/**
 * Date de tarissement prévue : ~60 jours avant la mise-bas pour les
 * espèces laitières (caprin, bovin). Null sinon.
 */
export function dateTarissementPrevue(
  dateMiseBas: Date,
  productionEspece: string | null | undefined
): Date | null {
  const p = (productionEspece || '').toLowerCase()
  if (!p.includes('lait') && !p.includes('mixte')) return null
  const d = new Date(dateMiseBas)
  d.setUTCDate(d.getUTCDate() - 60)
  return d
}

/**
 * Remonte les ancêtres d'un animal sur N générations.
 * Retourne un set d'IDs (incluant l'animal lui-même).
 */
export async function ancetres(
  tx: PrismaTx,
  animalId: number,
  generations = 3
): Promise<Set<number>> {
  const visited = new Set<number>()
  const queue: Array<{ id: number; depth: number }> = [{ id: animalId, depth: 0 }]

  while (queue.length > 0) {
    const cur = queue.shift()!
    if (visited.has(cur.id)) continue
    visited.add(cur.id)
    if (cur.depth >= generations) continue
    const a = await tx.animal.findUnique({
      where: { id: cur.id },
      select: { mereId: true, pereId: true },
    })
    if (!a) continue
    if (a.mereId) queue.push({ id: a.mereId, depth: cur.depth + 1 })
    if (a.pereId) queue.push({ id: a.pereId, depth: cur.depth + 1 })
  }
  return visited
}

/**
 * Détecte la consanguinité entre deux animaux : intersection des ancêtres
 * sur `generations`. Retourne les IDs d'ancêtres partagés (un seul suffit
 * à signaler — typiquement le père ou un grand-parent commun).
 */
export async function detecterConsanguinite(
  tx: PrismaTx,
  femelleId: number,
  maleId: number,
  generations = 3
): Promise<number[]> {
  if (femelleId === maleId) return [femelleId]
  const [aF, aM] = await Promise.all([
    ancetres(tx, femelleId, generations),
    ancetres(tx, maleId, generations),
  ])
  // On exclut les animaux eux-mêmes — on cherche les ancêtres COMMUNS strict
  aF.delete(femelleId)
  aM.delete(maleId)
  const communs: number[] = []
  for (const id of aF) if (aM.has(id)) communs.push(id)
  return communs
}

/**
 * Construit l'arbre généalogique sur N générations.
 * Retour : structure récursive avec père/mère imbriqués.
 */
export interface GenealogyNode {
  id: number
  nom: string | null
  identifiant: string | null
  sexe: string | null
  race: string | null
  dateNaissance: Date | null
  pere: GenealogyNode | null
  mere: GenealogyNode | null
}

export async function genealogie(
  tx: PrismaTx,
  animalId: number,
  generations = 2
): Promise<GenealogyNode | null> {
  if (generations < 0) return null
  const a = await tx.animal.findUnique({
    where: { id: animalId },
    select: {
      id: true,
      nom: true,
      identifiant: true,
      sexe: true,
      race: true,
      dateNaissance: true,
      mereId: true,
      pereId: true,
    },
  })
  if (!a) return null
  const [mere, pere] = await Promise.all([
    a.mereId ? genealogie(tx, a.mereId, generations - 1) : Promise.resolve(null),
    a.pereId ? genealogie(tx, a.pereId, generations - 1) : Promise.resolve(null),
  ])
  return {
    id: a.id,
    nom: a.nom,
    identifiant: a.identifiant,
    sexe: a.sexe,
    race: a.race,
    dateNaissance: a.dateNaissance,
    pere,
    mere,
  }
}
