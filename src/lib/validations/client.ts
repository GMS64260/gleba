import { z } from 'zod'

export const createClientSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(200),
  type: z.enum(['particulier', 'professionnel', 'association', 'amap']).optional().default('particulier'),
  email: z.string().email('Email invalide').max(200).nullable().optional(),
  telephone: z.string().max(30).nullable().optional(),
  adresse: z.string().max(500).nullable().optional(),
  ville: z.string().max(100).nullable().optional(),
  codePostal: z.string().max(10).nullable().optional(),
  pays: z.string().max(100).optional().default('France'),
  siret: z.string().max(20).nullable().optional(),
  tvaIntra: z.string().max(20).nullable().optional(),
  conditionsPaiement: z.coerce.number().int().min(0).max(365).optional().default(0),
  exonererTVA: z.boolean().optional().default(false),
  notes: z.string().max(5000).nullable().optional(),
  actif: z.boolean().optional().default(true),
})

export const updateClientSchema = createClientSchema.partial().extend({
  id: z.coerce.number().int().min(1, 'ID requis'),
})
