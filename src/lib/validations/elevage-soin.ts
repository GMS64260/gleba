import { z } from 'zod'
import { TYPES_SOIN as TYPES_SOIN_ECRAN } from '@/lib/elevage/types-soin'

// Types de soin : liste unique `src/lib/elevage/types-soin.ts` (écran, assistant,
// carnet sanitaire). Cette constante n'en est qu'une vue, pour ne pas tenir
// deux listes (QA 2026-10-19).
export const TYPES_SOIN: readonly string[] = TYPES_SOIN_ECRAN.map((t) => t.valeur)

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
    stockMedicamentId: z.string().nullable().optional(),
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
    // QA caprin cms1v5j14 — délais d'attente surchargeables par soin (ordonnance
    // vétérinaire, usage hors AMM/cascade). null/absent = valeur du produit.
    tempsAttenteLaitJ: z.number().int().min(0).max(365).nullable().optional(),
    tempsAttenteViandeJ: z.number().int().min(0).max(365).nullable().optional(),
    // QA 2026-07-30 — Délai de retrait sur les œufs (volailles pondeuses).
    tempsAttenteOeufsJ: z.number().int().min(0).max(365).nullable().optional(),
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
