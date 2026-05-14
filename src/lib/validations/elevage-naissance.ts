import { z } from 'zod'

export const naissanceSchema = z.object({
  mereId: z.number().int().nullable().optional(),
  pereIdentifiant: z.string().max(100).nullable().optional(),
  date: z.coerce.date().optional(),
  nombreNes: z.number().int().min(1, 'Nombre de nés ≥ 1'),
  nombreVivants: z.number().int().min(0),
  nombreMales: z.number().int().min(0).nullable().optional(),
  nombreFemelles: z.number().int().min(0).nullable().optional(),
  poidsTotal: z.number().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  // PROMPT 18 — lien optionnel vers la saillie d'origine
  saillieId: z.string().nullable().optional(),
})
