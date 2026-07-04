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
/**
 * POSTREVIEW Sprint 5 — Charge tous les ancêtres en une requête par génération
 * (1 query par niveau au lieu de N queries séquentielles) ET scope au userId
 * pour éviter de traverser dans un autre tenant suite à un FK SetNull / import
 * malformé.
 */
export async function ancetres(
  tx: PrismaTx,
  animalId: number,
  generations = 3,
  userId?: string
): Promise<Set<number>> {
  const visited = new Set<number>([animalId])
  let frontier = new Set<number>([animalId])

  for (let depth = 0; depth < generations; depth++) {
    if (frontier.size === 0) break
    const animaux = await tx.animal.findMany({
      where: {
        id: { in: Array.from(frontier) },
        ...(userId ? { userId } : {}),
      },
      select: { mereId: true, pereId: true },
    })
    const next = new Set<number>()
    for (const a of animaux) {
      if (a.mereId && !visited.has(a.mereId)) {
        visited.add(a.mereId)
        next.add(a.mereId)
      }
      if (a.pereId && !visited.has(a.pereId)) {
        visited.add(a.pereId)
        next.add(a.pereId)
      }
    }
    frontier = next
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
  generations = 3,
  userId?: string
): Promise<number[]> {
  if (femelleId === maleId) return [femelleId]
  // ancetres() inclut l'animal lui-même + ses ascendants. On intersecte les
  // deux ensembles COMPLETS : cela capture les ancêtres communs ET le cas
  // parent×enfant direct (le père appartient aux ancêtres de sa fille, donc
  // il figure dans l'intersection). L'ancienne version supprimait chaque
  // animal de son propre ensemble avant l'intersection → l'accouplement
  // père×fille passait inaperçu si le père n'avait pas d'ancêtres enregistrés
  // (audit 2026-07, #18). femelleId et maleId étant distincts (early return),
  // aucun faux positif : un animal n'apparaît dans l'ensemble de l'autre que
  // s'il en est réellement un ascendant.
  const [aF, aM] = await Promise.all([
    ancetres(tx, femelleId, generations, userId),
    ancetres(tx, maleId, generations, userId),
  ])
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
