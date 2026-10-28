import { z } from 'zod'
import { MODES_REGLEMENT } from './reglement'

export const cibleReglementSchema = z.object({
  type: z.enum(['Facture', 'VenteProduit', 'VenteManuelle', 'DepenseManuelle']),
  id: z.coerce.number().int().positive(),
})
export type CibleDeReglement = z.infer<typeof cibleReglementSchema>
export const nouveauReglementSchema = cibleReglementSchema.extend({
  montant: z.union([z.number(), z.string().min(1).max(30)]),
  date: z.coerce.date().min(new Date('1990-01-01')),
  modeReglement: z
    .enum(MODES_REGLEMENT)
    .refine((v) => v !== 'À crédit', 'Un règlement doit avoir un mode de paiement effectif.'),
  reference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  cleIdempotence: z.string().min(16).max(100),
  remboursement: z.boolean().optional(),
  regularisationHistorique: z.boolean().optional(),
})
export const annulerReglementSchema = z.object({
  id: z.string().min(1).max(100),
  motif: z.string().trim().min(3).max(500),
})
export const compteBancaireSchema = z.object({
  nom: z.string().trim().min(1).max(100),
  devise: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default('EUR'),
})
export const rapprochementSchema = z
  .object({
    operationId: z.string().min(1).max(100),
    partie: z.enum(['principal', 'frais']).default('principal'),
    reglementId: z.string().min(1).max(100).optional(),
    modeReglement: z
      .enum(MODES_REGLEMENT)
      .refine((v) => v !== 'À crédit')
      .optional(),
    cible: cibleReglementSchema.optional(),
    montant: z.union([z.number(), z.string().min(1).max(30)]).optional(),
    cleIdempotence: z.string().min(16).max(100),
    remboursement: z.boolean().optional(),
  })
  .refine(
    (v) => Boolean(v.reglementId) !== Boolean(v.cible),
    'Choisissez un règlement existant ou une pièce à régler.',
  )
