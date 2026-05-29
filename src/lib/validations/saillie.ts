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
  // La confirmation de gestation ne peut pas précéder la saillie.
  .refine((d) => !d.confirmationGestation || d.confirmationGestation >= d.date, {
    message: 'La confirmation de gestation ne peut pas précéder la date de saillie',
    path: ['confirmationGestation'],
  })

export const updateSaillieSchema = z.object({
  id: z.string().min(1),
  // POSTREVIEW Sprint 5 — Autoriser la modification de la date pour recalculer
  // dateMiseBasAttendue (avant : impossible sans DELETE+POST)
  date: z.coerce.date().optional(),
  confirmationGestation: z.coerce.date().nullable().optional(),
  statut: z.enum(STATUTS_SAILLIE).optional(),
  notes: z.string().max(2000).nullable().optional(),
  agentInseminateur: z.string().max(200).nullable().optional(),
  semenceLot: z.string().max(100).nullable().optional(),
  pereExterneRef: z.string().max(200).nullable().optional(),
})
  // Si les deux dates sont fournies, la confirmation ne précède pas la saillie.
  .refine((d) => !d.confirmationGestation || !d.date || d.confirmationGestation >= d.date, {
    message: 'La confirmation de gestation ne peut pas précéder la date de saillie',
    path: ['confirmationGestation'],
  })

export type SaillieInput = z.infer<typeof saillieSchema>
