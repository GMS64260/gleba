import { z } from 'zod'

export const consommationAlimentSchema = z.object({
  alimentId: z.string().min(1, 'Aliment requis'),
  lotId: z.number().int().nullable().optional(),
  animalId: z.number().int().nullable().optional(),
  date: z.coerce.date().default(() => new Date()),
  quantite: z.number().positive('La quantité doit être positive'),
  notes: z.string().max(5000).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.lotId != null && value.animalId != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Choisissez un lot ou un animal, pas les deux.',
      path: ['animalId'],
    })
  }
})
