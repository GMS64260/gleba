import { z } from 'zod'
import { isValidSiret, isValidTvaIntracomFr } from '@/lib/siret'

const optionalSiret = z
  .string()
  .max(20)
  .transform((v) => v.replace(/\s+/g, ''))
  .refine((v) => v === '' || isValidSiret(v), 'SIRET invalide (clé de Luhn)')
  .nullable()
  .optional()

const optionalTvaIntra = z
  .string()
  .max(20)
  .transform((v) => v.replace(/\s+/g, '').toUpperCase())
  .refine((v) => v === '' || isValidTvaIntracomFr(v), 'Numéro de TVA intracommunautaire invalide')
  .nullable()
  .optional()

export const createFournisseurSchema = z.object({
  id: z.string().min(1, 'Nom/ID requis').max(100),
  contact: z.string().max(200).nullable().optional(),
  adresse: z.string().max(500).nullable().optional(),
  ville: z.string().max(100).nullable().optional(),
  codePostal: z.string().max(10).nullable().optional(),
  pays: z.string().max(100).optional().default('France'),
  email: z.string().email('Email invalide').max(200).nullable().optional(),
  telephone: z.string().max(30).nullable().optional(),
  siteWeb: z.string().max(300).nullable().optional(),
  siret: optionalSiret,
  tvaIntra: optionalTvaIntra,
  type: z.string().max(50).nullable().optional(),
  conditionsPaiement: z.coerce.number().int().min(0).max(365).optional().default(30),
  notes: z.string().max(5000).nullable().optional(),
  actif: z.boolean().optional().default(true),
})

export const updateFournisseurSchema = createFournisseurSchema.partial().extend({
  id: z.string().min(1, 'ID requis'),
})
