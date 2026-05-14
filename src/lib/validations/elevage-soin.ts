import { z } from 'zod'

export const soinSchema = z.object({
  animalId: z.number().int().nullable().optional(),
  lotId: z.number().int().nullable().optional(),
  date: z.coerce.date().optional(),
  type: z.string().min(1, 'Type requis'),
  description: z.string().max(500).nullable().optional(),
  produit: z.string().max(200).nullable().optional(),
  quantite: z.number().min(0).nullable().optional(),
  unite: z.string().max(50).nullable().optional(),
  cout: z.number().min(0).nullable().optional(),
  veterinaire: z.string().max(200).nullable().optional(),
  datePrevue: z.coerce.date().nullable().optional(),
  fait: z.boolean().default(true),
  notes: z.string().max(5000).nullable().optional(),
}).refine(
  data => data.animalId != null || data.lotId != null,
  { message: 'Animal ou lot requis', path: ['animalId'] }
)
