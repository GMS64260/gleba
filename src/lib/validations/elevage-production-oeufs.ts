import { z } from 'zod'

export const productionOeufsSchema = z.object({
  lotId: z.number().int().nullable().optional(),
  animalId: z.number().int().nullable().optional(),
  date: z.coerce.date().optional(),
  quantite: z.number().int().min(1, 'Quantité ≥ 1'),
  casses: z.number().int().min(0).default(0),
  sales: z.number().int().min(0).default(0),
  calibre: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
}).refine(
  data => data.lotId != null || data.animalId != null,
  { message: 'Lot ou animal requis', path: ['lotId'] }
)
