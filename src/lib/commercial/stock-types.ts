import { z } from 'zod'

export const TYPES_STOCK_COMMERCIAL = ['recolte', 'fruit', 'bois', 'boutique', 'oeufs', 'ruche', 'fromage'] as const
export type TypeStockCommercial = (typeof TYPES_STOCK_COMMERCIAL)[number]
export const champsArticleStock = {
  articleStockType: z.enum(TYPES_STOCK_COMMERCIAL).nullable().optional(),
  articleStockId: z.string().trim().min(1).max(120).nullable().optional(),
}
export interface ReferenceArticleStock { articleStockType?: string | null; articleStockId?: string | null }
export interface ArticleStockCommercial {
  type: TypeStockCommercial
  id: string
  nom: string
  categorie: string
  disponible: number | null
  unite: string
  prixTTC: number | null
  tauxTVA: number
  statutBio: string | null
  href: string
  dateLot?: string
}
export function cleArticle(a: Pick<ArticleStockCommercial, 'type' | 'id'>) { return `${a.type}:${a.id}` }
export function disponibleCommercial(lot: { quantite: number; stockDisponibleCommercial?: number | null }) {
  return lot.stockDisponibleCommercial ?? lot.quantite
}
/** Ces identifiants sont remappés lors du transfert d'un compte entre instances. */
export const MODELES_STOCK_COMMERCIAL: Record<string, string> = {
  recolte: 'Recolte', fruit: 'RecolteArbre', bois: 'ProductionBois', boutique: 'ProduitBoutique', fromage: 'LotFromage',
}
export function stockEstDenombrable(unite: string) {
  return ['piece', 'pièce', 'pièces', 'unite', 'unité', 'unités', 'tige', 'tiges', 'botte', 'bottes', 'oeufs', 'œufs', 'boîte', 'douzaine', 'plateau'].includes(unite.toLowerCase())
}

export function quantiteBois(b: { volumeStere: number | null; volumeM3: number | null; poidsKg: number | null }) {
  return b.volumeStere != null ? { quantite: b.volumeStere, unite: 'stère' } : b.volumeM3 != null ? { quantite: b.volumeM3, unite: 'm³' } : { quantite: b.poidsKg ?? 0, unite: 'kg' }
}
