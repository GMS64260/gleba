import { z } from 'zod'

// PROMPT 19B — Types de soin étendus (vaccination, parage, prophylaxie, ...)
export const TYPES_SOIN = [
  'Vaccination',
  'Vermifuge',
  'Traitement vétérinaire',
  'Tonte',
  'Parage onglons',
  'Castration',
  'Identification',
  'Prophylaxie obligatoire',
  'Coproscopie',
  'Mise en lutte',
  'Tarissement',
  'Autre',
] as const

export const VOIES_ADMIN = ['IM', 'SC', 'IV', 'PO', 'Local', 'IN', 'Vaginal', 'Intra-mamm.', 'Pour-on', 'Autre'] as const

export const soinFieldsSchema = z.object({
    animalId: z.number().int().nullable().optional(),
    lotId: z.number().int().nullable().optional(),
    date: z.coerce.date().optional(),
    type: z.string().min(1, 'Type requis'),
    description: z.string().max(500).nullable().optional(),
    produit: z.string().max(200).nullable().optional(),
    // PROMPT 19B — produit véto FK + métadonnées
    produitId: z.string().nullable().optional(),
    dose: z.string().max(100).nullable().optional(),
    voie: z.enum(VOIES_ADMIN).nullable().optional(),
    motif: z.string().max(500).nullable().optional(),
    ordonnanceUrl: z.string().url().nullable().optional().or(z.literal('')),
    quantite: z.number().min(0).nullable().optional(),
    unite: z.string().max(50).nullable().optional(),
    cout: z.number().min(0).nullable().optional(),
    veterinaire: z.string().max(200).nullable().optional(),
    datePrevue: z.coerce.date().nullable().optional(),
    fait: z.boolean().default(true),
    notes: z.string().max(5000).nullable().optional(),
    // PROMPT 30 — traitement à plusieurs injections (délai d'attente depuis la dernière)
    nbInjections: z.number().int().min(1).max(30).optional(),
    intervalleInjectionsHeures: z.number().int().min(1).max(2160).nullable().optional(),
  })

export const soinSchema = soinFieldsSchema
  // PROMPT 19B — XOR strict : animalId OU lotId (pas les deux, au moins un)
  .refine(
    (d) => (d.animalId != null && d.lotId == null) || (d.animalId == null && d.lotId != null),
    { message: 'Renseignez exactement un animal OU un lot.', path: ['animalId'] }
  )

export const soinPatchSchema = soinFieldsSchema.partial().extend({
  id: z.coerce.number().int().positive(),
}).superRefine((d, ctx) => {
  if (d.nbInjections != null && d.nbInjections > 1 && d.intervalleInjectionsHeures == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["intervalleInjectionsHeures"],
      message: "Intervalle requis pour plusieurs injections",
    })
  }
})
