import { z } from 'zod'

export const livraisonLaitSchema = z.object({
  date: z.coerce.date(),
  litres: z.coerce.number().positive(),
  laiterie: z.string().max(200).nullable().optional(),
  tb: z.coerce.number().min(0).max(100).nullable().optional(),
  tp: z.coerce.number().min(0).max(100).nullable().optional(),
  // Cellules/germes en ×10³/mL (milliers/mL). Plafond garde-fou : au-delà de
  // 20 000 (= 20 M/mL, invraisemblable) c'est presque sûrement une saisie en
  // valeur BRUTE (ex. 650000 au lieu de 650) — on rejette avec un message clair.
  cellules: z.coerce.number().int().min(0).max(20000, { message: 'Cellules en milliers/mL (ex. 650 pour 650 000). Une valeur brute (> 20 000) est probablement une erreur d’unité.' }).nullable().optional(),
  germes: z.coerce.number().int().min(0).max(20000, { message: 'Germes en milliers/mL (ex. 25 pour 25 000). Une valeur brute (> 20 000) est probablement une erreur d’unité.' }).nullable().optional(),
  lipolyse: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})
