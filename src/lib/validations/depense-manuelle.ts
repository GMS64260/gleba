import { z } from 'zod'
import { refusVentilationFournie } from '@/lib/comptabilite/ventilation-ttc'

const JOURNAUX = ['VE', 'AC', 'BQ', 'CA', 'OD'] as const
const MODES_REGLEMENT = ['Espèces', 'Chèque', 'Virement', 'CB', 'Prélèvement', 'À crédit'] as const

const depenseManuelleBase = z.object({
  date: z.coerce.date().optional(),
  categorie: z.string().min(1, 'Catégorie requise'),
  description: z.string().min(1, 'Description requise').max(500),
  tauxTVA: z.number().min(0).max(100).optional().default(20),
  montant: z.number().min(0, 'Montant requis'),
  montantHT: z.number().min(0).nullable().optional(),
  montantTVA: z.number().min(0).nullable().optional(),
  module: z.string().max(50).nullable().optional(),
  fournisseurId: z.string().nullable().optional(),
  fournisseurNom: z.string().max(200).nullable().optional(),
  refFacture: z.string().max(100).nullable().optional(),
  paye: z.boolean().optional().default(true),
  dateEcheance: z.coerce.date().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  // PROMPT 15A
  journal: z.enum(JOURNAUX).optional().default('AC'),
  modeReglement: z.enum(MODES_REGLEMENT).nullable().optional(),
  numeroPiece: z.string().max(50).nullable().optional(),
  pjUrl: z.string().url().nullable().optional().or(z.literal('')),
})

/**
 * COM-02 (revue Codex du 2026-11-12) : HT et TVA fournis doivent être
 * cohérents avec le TTC et le taux (somme exacte au centime) ; absents, la
 * route les calcule. Une modification partielle se contrôle dans la route,
 * contre l'écriture relue sous verrou.
 */
export const createDepenseManuelleSchema = depenseManuelleBase.superRefine((v, ctx) => {
  const refus = refusVentilationFournie(v.montant, v.tauxTVA, v.montantHT, v.montantTVA)
  if (refus) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['montantTVA'], message: refus })
})

export const updateDepenseManuelleSchema = depenseManuelleBase.partial().extend({
  id: z.number().int().min(1, 'ID requis'),
})
