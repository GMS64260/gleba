import { z } from 'zod'
import { caseInsensitiveEnum } from './case-insensitive-enum'

// Bug cmp8rzcjc (Marc 2026-05-16) — une vente fantôme (animal inexistant,
// prix unitaire 0, statut Payé) pouvait être créée. On verrouille :
//  - prix unitaire > 0 sauf si paye=false (don/échantillon en attente)
//  - une vente "Payé" à 0 € est rejetée (incohérent en compta)
//  - animalId, si fourni, est validé en API contre le cheptel
export const venteProduitSchema = z
  .object({
    date: z.coerce.date().optional(),
    // DEV1 T1 — Résilient à la casse.
    type: caseInsensitiveEnum(['oeufs', 'viande', 'animal_vivant', 'lait', 'autre'] as const),
    description: z.string().max(500).nullable().optional(),
    quantite: z.number().positive('La quantité doit être positive'),
    unite: z.string().min(1, 'Unité requise'),
    prixUnitaire: z.number().min(0, 'Le prix doit être positif ou nul'),
    client: z.string().max(200).nullable().optional(),
    destinationId: z.string().nullable().optional(),
    paye: z.boolean().default(true),
    tauxTVA: z.number().min(0).max(100).default(5.5),
    animalId: z.number().int().nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .refine((d) => !(d.paye === true && d.prixUnitaire === 0), {
    message:
      'Une vente marquée "Payé" ne peut pas avoir un prix unitaire de 0 € (incohérent en comptabilité). Décochez "Payé" ou saisissez un prix.',
    path: ['prixUnitaire'],
  })
