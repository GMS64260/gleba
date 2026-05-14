import { z } from 'zod'

export const lotSchema = z.object({
  especeAnimaleId: z.string().min(1, 'Espèce animale requise'),
  nom: z.string().max(200).nullable().optional(),
  dateArrivee: z.coerce.date().optional(),
  quantiteInitiale: z.number().int().min(1, 'Quantité initiale ≥ 1'),
  provenance: z.string().max(200).nullable().optional(),
  prixAchatTotal: z.number().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  parcelleGeoId: z.string().nullable().optional(),
})
