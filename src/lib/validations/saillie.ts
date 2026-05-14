import { z } from 'zod'

export const TYPES_SAILLIE = ['Monte naturelle', 'IA', 'Transfert embryon'] as const
export const STATUTS_SAILLIE = ['En attente', 'Gestante', 'Non gestante', 'Mise-bas réalisée', 'Avortement'] as const

export const saillieSchema = z.object({
  date: z.coerce.date(),
  femelleId: z.coerce.number().int().positive(),
  maleId: z.coerce.number().int().positive().nullable().optional(),
  type: z.enum(TYPES_SAILLIE),
  agentInseminateur: z.string().max(200).nullable().optional(),
  semenceLot: z.string().max(100).nullable().optional(),
  pereExterneRef: z.string().max(200).nullable().optional(),
  confirmationGestation: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const updateSaillieSchema = z.object({
  id: z.string().min(1),
  confirmationGestation: z.coerce.date().nullable().optional(),
  statut: z.enum(STATUTS_SAILLIE).optional(),
  notes: z.string().max(2000).nullable().optional(),
  agentInseminateur: z.string().max(200).nullable().optional(),
  semenceLot: z.string().max(100).nullable().optional(),
  pereExterneRef: z.string().max(200).nullable().optional(),
})

export type SaillieInput = z.infer<typeof saillieSchema>
