import { z } from 'zod'

/**
 * Les formulaires HTML envoient TOUJOURS des chaînes (`<input type="number">`
 * inclus). Avant coercition, `doseAppliquee: ""` ou `"2,5"` faisait échouer
 * `z.number()` → 400 systématique à la création d'intervention (audit 2026-07).
 *
 * `numInput` normalise ces entrées : "" / null / undefined → null,
 * "2,5" ou "2.5" → 2.5, valeur non numérique laissée telle quelle pour
 * déclencher un message d'erreur zod explicite. Les nombres passent inchangés
 * (rétro-compatible avec les appelants qui envoient déjà des number).
 */
const coerceNum = (v: unknown): unknown => {
  if (v === '' || v === null || v === undefined) return null
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.').trim())
    return Number.isNaN(n) ? v : n
  }
  return v
}
const numInput = () => z.preprocess(coerceNum, z.number().min(0).nullable()).optional()
const intInput = () => z.preprocess(coerceNum, z.number().int().min(0).nullable()).optional()

export const createInterventionSchema = z.object({
  date: z.coerce.date(),
  type: z.string().min(1, 'Type requis'),
  cultureId: z.preprocess(coerceNum, z.number().int().nullable()).optional(),
  plancheId: z.string().nullable().optional(),
  arbreId: z.preprocess(coerceNum, z.number().int().nullable()).optional(),
  description: z.string().max(1000).nullable().optional(),
  dureeMinutes: intInput(),
  nbPersonnes: z.preprocess(coerceNum, z.number().int().min(1).nullable()).optional().transform((v) => v ?? 1),
  coutMainOeuvre: numInput(),
  coutTotal: numInput(),
  datePrevue: z.coerce.date().nullable().optional(),
  fait: z.boolean().optional().default(true),
  // Phyto
  produitPhyto: z.string().max(200).nullable().optional(),
  numAMM: z.string().max(50).nullable().optional(),
  cibleTraitement: z.string().max(200).nullable().optional(),
  doseAppliquee: numInput(),
  uniteDose: z.string().max(50).nullable().optional(),
  surfaceTraitee: numInput(),
  dar: intInput(),
  delaiReentree: intInput(),
  conditionsMeteo: z.string().max(200).nullable().optional(),
  // Intrant
  intrantNom: z.string().max(200).nullable().optional(),
  intrantQuantite: numInput(),
  intrantUnite: z.string().max(50).nullable().optional(),
  intrantCout: numInput(),
  intrantNumLot: z.string().max(100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  // PROMPT 11 LOT B/D — Réglementaire phyto + traçabilité PBI
  produitPhytoId: z.string().nullable().optional(),
  volumeBouillieLHa: numInput(),
  temperatureC: z.preprocess(coerceNum, z.number().nullable()).optional(),
  ventKmh: numInput(),
  hygrometriePct: z.preprocess(coerceNum, z.number().int().min(0).max(100).nullable()).optional(),
  operateurId: z.string().nullable().optional(),
  certiphytoNum: z.string().max(50).nullable().optional(),
  certiphytoValidite: z.coerce.date().nullable().optional(),
  justification: z.string().max(2000).nullable().optional(),
  observationLieeId: z.preprocess(coerceNum, z.number().int().nullable()).optional(),
})

export const updateInterventionSchema = createInterventionSchema.partial().extend({
  id: z.number().int().min(1, 'ID requis'),
})
