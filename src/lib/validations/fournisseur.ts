import { z } from 'zod'
import { isValidSiret, isValidSiren, isValidTvaIntracomFr } from '@/lib/siret'
import { isValidIban, isValidBic, FOURNISSEUR_TYPES } from '@/lib/iban'

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

const optionalIban = z
  .string()
  .max(34)
  .transform((v) => v.replace(/\s+/g, '').toUpperCase())
  .refine((v) => v === '' || isValidIban(v), 'IBAN invalide (modulo 97)')
  .nullable()
  .optional()

const optionalBic = z
  .string()
  .max(11)
  .transform((v) => v.replace(/\s+/g, '').toUpperCase())
  .refine((v) => v === '' || isValidBic(v), 'BIC invalide (format SWIFT)')
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
  siren: optionalSiren,
  tvaIntra: optionalTvaIntra,
  // DEV2 #5 — Type canonique (8 valeurs). On tolère les anciennes valeurs
  // ('mixte', 'aliments', ...) en passthrough pour rétro-compat.
  type: z.string().max(50).nullable().optional(),
  // Bloc bancaire (TODO chiffrer côté DB)
  iban: optionalIban,
  bic: optionalBic,
  ribCle: z.string().max(5).regex(/^\d{2}$|^$/, 'Clé RIB = 2 chiffres').nullable().optional(),
  banqueNom: z.string().max(100).nullable().optional(),
  conditionsPaiement: z.coerce.number().int().min(0).max(365).optional().default(30),
  notes: z.string().max(5000).nullable().optional(),
  actif: z.boolean().optional().default(true),
})

export { FOURNISSEUR_TYPES }

export const updateFournisseurSchema = createFournisseurSchema.partial().extend({
  id: z.string().min(1, 'ID requis'),
})
