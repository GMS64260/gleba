/**
 * Schémas de validation Zod pour les Récoltes
 */

import { z } from 'zod'

export const recolteSchema = z.object({
  especeId: z.string().min(1, "L'espèce est requise"),
  cultureId: z.number().int().min(1, "La culture est requise"),
  date: z.coerce.date().default(() => new Date()),
  quantite: z.number().min(0, "La quantité doit être positive"),
  datePeremption: z.coerce.date().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export const createRecolteSchema = recolteSchema
export const updateRecolteSchema = recolteSchema.partial()

/**
 * BUG-07 — Schéma PATCH pour les transitions de statut (vendu, perte, etc).
 * Quand `statut = 'vendu'`, on exige prix + date + client. Le PATCH côté
 * route applique aussi `safeParse` et renvoie 400 si la cohérence n'est pas
 * respectée. Le but : interdire qu'une « vente fantôme » se crée et fausse
 * tous les KPI (CA moyen, marge, etc.).
 */
export const statutRecolteEnum = z.enum(['en_stock', 'vendu', 'consomme', 'perte', 'a_completer'])

export const recoltePatchSchema = z.object({
  statut: statutRecolteEnum.optional(),
  dateVente: z.coerce.date().nullable().optional(),
  prixKg: z.number().min(0).nullable().optional(),
  prixTotal: z.number().min(0).nullable().optional(),
  // Vente partielle : quantité réellement vendue (≤ quantité de la récolte).
  // Le reliquat reste en stock (la route PATCH scinde la récolte).
  quantiteVendue: z.number().positive().nullable().optional(),
  // Recolte.clientId est un Int en base (FK Client.id) — le front envoie un
  // number. L'ancien z.string() faisait échouer TOUT PATCH de vente avec un
  // client existant sélectionné (400 silencieux).
  clientId: z.number().int().nullable().optional(),
  clientNom: z.string().nullable().optional(),
  datePeremption: z.coerce.date().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  creerFacture: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.statut === 'vendu') {
    const aUnPrix =
      (data.prixKg !== undefined && data.prixKg !== null && data.prixKg > 0) ||
      (data.prixTotal !== undefined && data.prixTotal !== null && data.prixTotal > 0)
    if (!aUnPrix) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prixKg'],
        message: 'Un prix (prix/kg ou prix total) est requis pour marquer comme vendu.',
      })
    }
    if (!data.dateVente) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dateVente'],
        message: 'La date de vente est requise pour le statut « vendu ».',
      })
    }
    const aUnClient =
      typeof data.clientId === 'number' ||
      (typeof data.clientNom === 'string' && data.clientNom.length > 0)
    if (!aUnClient) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clientNom'],
        message: 'Le client (id ou nom) est requis pour le statut « vendu ».',
      })
    }
  }
})

export type RecolteInput = z.infer<typeof recolteSchema>
export type CreateRecolteInput = z.infer<typeof createRecolteSchema>
export type UpdateRecolteInput = z.infer<typeof updateRecolteSchema>
export type RecoltePatchInput = z.infer<typeof recoltePatchSchema>
