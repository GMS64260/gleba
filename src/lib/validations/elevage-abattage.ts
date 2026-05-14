import { z } from 'zod'

export const abattageSchema = z.object({
  animalId: z.number().int().nullable().optional(),
  lotId: z.number().int().nullable().optional(),
  date: z.coerce.date().optional(),
  quantite: z.number().int().min(1).default(1),
  poidsVif: z.number().min(0).nullable().optional(),
  poidsCarcasse: z.number().min(0).nullable().optional(),
  destination: z.enum(['auto_consommation', 'vente', 'don']),
  prixVente: z.number().min(0).nullable().optional(),
  lieu: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
}).refine(
  data => data.animalId != null || data.lotId != null,
  { message: 'Animal ou lot requis', path: ['animalId'] }
)
