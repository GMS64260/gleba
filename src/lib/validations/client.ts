import { z } from 'zod'
import { emailOptionnel } from './email-optionnel'
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

const clientBaseSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(200),
  // DEV1 T1 — Résilient à la casse : accepte 'particulier', 'Particulier',
  // 'PARTICULIER' et normalise vers 'particulier' (canonique).
  type: caseInsensitiveEnum(['particulier', 'professionnel', 'association', 'amap'] as const)
    .optional()
    .default('particulier'),
  email: emailOptionnel(),
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

/**
 * Facturation électronique (lot 1, 2026-10-13) : une facture B2B porte le SIREN
 * de l'acheteur (BT-47, art. 242 nonies A). Un client professionnel sans SIRET
 * ni SIREN ne pourrait être facturé électroniquement : on l'exige à la création.
 */
export const createClientSchema = clientBaseSchema.superRefine((c, ctx) => {
  if (c.type === 'professionnel' && !c.siret && !c.siren) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['siren'],
      message: 'SIRET ou SIREN requis pour un client professionnel (identifiant de l’acheteur obligatoire sur une facture électronique)',
    })
  }
})

export const updateClientSchema = clientBaseSchema.partial().extend({
  id: z.coerce.number().int().min(1, 'ID requis'),
})
