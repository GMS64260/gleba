import { z } from 'zod'

export const lotSchema = z.object({
  especeAnimaleId: z.string().min(1, 'Espèce animale requise'),
  nom: z.string().max(200).nullable().optional(),
  dateArrivee: z.coerce.date().optional(),
  // 0 est admis : un lot ouvert pour recevoir des naissances (« Agneaux 2026 »)
  // n'a aucune tête à l'arrivée ; ce sont les naissances qui le créditent.
  quantiteInitiale: z.number().int().min(0, 'Quantité initiale ≥ 0'),
  provenance: z.string().max(200).nullable().optional(),
  prixAchatTotal: z.number().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  parcelleGeoId: z.string().nullable().optional(),
})
