import { z } from 'zod'
import { isValidSiret, isValidSiren, isValidTvaIntracomFr } from '@/lib/siret'
import { caseInsensitiveEnum } from './case-insensitive-enum'

const optionalSiret = z
  .string()
  .max(20)
  .transform((v) => v.replace(/\s+/g, ''))
  .refine((v) => v === '' || isValidSiret(v), 'SIRET invalide (clé de Luhn)')
  .nullable()
  .optional()

const optionalSiren = z
  .string()
  .max(11)
  .transform((v) => v.replace(/\s+/g, ''))
  .refine((v) => v === '' || isValidSiren(v), 'SIREN invalide (clé de Luhn)')
  .nullable()
  .optional()

const optionalTvaIntra = z
  .string()
  .max(20)
  .transform((v) => v.replace(/\s+/g, '').toUpperCase())
  .refine((v) => v === '' || isValidTvaIntracomFr(v), 'Numéro de TVA intracommunautaire invalide')
  .nullable()
  .optional()

export const createClientSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(200),
  // DEV1 T1 — Résilient à la casse : accepte 'particulier', 'Particulier',
  // 'PARTICULIER' et normalise vers 'particulier' (canonique).
  type: caseInsensitiveEnum(['particulier', 'professionnel', 'association', 'amap'] as const)
    .optional()
    .default('particulier'),
  email: z.string().email('Email invalide').max(200).nullable().optional(),
  telephone: z.string().max(30).nullable().optional(),
  adresse: z.string().max(500).nullable().optional(),
  ville: z.string().max(100).nullable().optional(),
  codePostal: z.string().max(10).nullable().optional(),
  pays: z.string().max(100).optional().default('France'),
  siret: optionalSiret,
  siren: optionalSiren,
  tvaIntra: optionalTvaIntra,
  conditionsPaiement: z.coerce.number().int().min(0).max(365).optional().default(0),
  exonererTVA: z.boolean().optional().default(false),
  notes: z.string().max(5000).nullable().optional(),
  actif: z.boolean().optional().default(true),
})

export const updateClientSchema = createClientSchema.partial().extend({
  id: z.coerce.number().int().min(1, 'ID requis'),
})
