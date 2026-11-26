/**
 * Lignée des lots de récolte.
 *
 * Une vente ou une sortie partielle scinde une ligne de `recoltes` en deux :
 * la part créée porte `recolteOrigineId`, l'identifiant de la récolte SAISIE
 * (la racine, jamais une part intermédiaire). Compter des lignes annonçait
 * « 2 récoltes » pour une seule saisie (défaut D51, 2026-11-25).
 *
 * Règle : le nombre de récoltes saisies est le nombre de lignées distinctes
 * parmi les lignes lues, jamais le nombre de racines. Il ne vaut donc jamais 0
 * quand des lignes existent (une part dont la racine est hors du filtre, autre
 * année par exemple, compte pour une récolte là où elle se trouve) : une garde
 * « cette culture a des récoltes » donne le même verdict sur les lignes et sur
 * les lignées.
 *
 * Une récolte saisie qui disparaît ou change d'origine (supprimée, rattachée à
 * une autre culture ou à une autre espèce) cède sa place à sa part la plus
 * ancienne : `cederLaLignee`. Une part rattachée ailleurs redevient une récolte.
 *
 * Aucun import d'exécution : importable par un écran.
 */
import type { Prisma } from '@prisma/client'

/**
 * Une « récolte saisie », au sens des compteurs par compte : ni une part de
 * lot scindé (`recolteOrigineId`), ni un lot d'inventaire né d'un comptage de
 * stock (`cultureId` nul). Un seul filtre pour tous les compteurs : sans la
 * seconde condition, chaque comptage de stock ajoutait une « récolte » dans
 * l'administration (équipe debug, D89).
 */
export const WHERE_RECOLTE_SAISIE = {
  cultureId: { not: null },
  recolteOrigineId: null,
} satisfies Prisma.RecolteWhereInput

export interface LigneDeLignee {
  id: number
  recolteOrigineId?: number | null
}

/** Identifiant de la récolte saisie dont cette ligne est une part (ou elle-même). */
export function cleLignee(ligne: LigneDeLignee): number {
  return ligne.recolteOrigineId ?? ligne.id
}

/** Nombre de récoltes saisies parmi ces lignes. */
export function compterLignees(lignes: readonly LigneDeLignee[]): number {
  return new Set(lignes.map(cleLignee)).size
}

/** Lecture minimale pour compter les récoltes saisies d'une culture. */
export async function compterRecoltesSaisies(
  client: { recolte: { findMany(args: { where: { cultureId: number; userId: string }; select: { id: true; recolteOrigineId: true } }): Promise<LigneDeLignee[]> } },
  cultureId: number,
  userId: string,
): Promise<number> {
  return compterLignees(await client.recolte.findMany({ where: { cultureId, userId }, select: { id: true, recolteOrigineId: true } }))
}

/**
 * La récolte saisie `racineId` quitte sa lignée : sa part la plus ancienne en
 * devient la récolte saisie, les autres la suivent. Sans cela, la base détache
 * chaque part d'une racine supprimée (SET NULL) et une seule récolte se
 * compterait autant de fois qu'elle a de parts. Rend le nombre de parts.
 * À appeler sous le verrou du stock commercial, comme les scissions.
 */
export async function cederLaLignee(tx: Prisma.TransactionClient, userId: string, racineId: number): Promise<number> {
  const parts = await tx.recolte.findMany({ where: { userId, recolteOrigineId: racineId }, orderBy: { id: 'asc' }, select: { id: true } })
  if (parts.length === 0) return 0
  const [heritiere, ...suivantes] = parts
  if (suivantes.length > 0) {
    await tx.recolte.updateMany({ where: { userId, recolteOrigineId: racineId, id: { not: heritiere.id } }, data: { recolteOrigineId: heritiere.id } })
  }
  await tx.recolte.updateMany({ where: { userId, id: heritiere.id }, data: { recolteOrigineId: null } })
  return parts.length
}

/**
 * Note que le code écrivait sur la ligne créée par une scission AVANT la
 * colonne de lignée ; elle cite l'identifiant de la ligne d'origine. Seul
 * indice d'une scission ancienne (même expression que la reprise,
 * scripts/reprise-lignee-recoltes.ts).
 */
export const NOTE_SCISSION = /^(?:Reliquat non vendu de la récolte|Reliquat de la récolte|Part sortie de la récolte) #(\d{1,9})/
