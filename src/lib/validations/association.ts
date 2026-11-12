/**
 * Schémas de validation pour les associations de plantes
 */

import { z } from "zod"

// Schéma pour un detail d'association
export const associationDetailSchema = z.object({
  id: z.number().optional(),
  especeId: z.string().nullable().optional(),
  familleId: z.string().nullable().optional(),
  groupe: z.string().max(100).nullable().optional(),
  requise: z.boolean(),
  notes: z.string().max(2000).nullable().optional(),
})

// Audit Marc 2026-05-14 — Bug 19 : champ type explicite pour
// favorable / incompatible / neutre. Cf. migration 20260514370000.
export const ASSOCIATION_TYPES = ['favorable', 'incompatible', 'neutre'] as const
export type AssociationType = (typeof ASSOCIATION_TYPES)[number]

// Schéma de base pour une association
export const baseAssociationSchema = z.object({
  nom: z.string().min(1, "Le nom est requis").max(200),
  description: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  type: z.enum(ASSOCIATION_TYPES),
})

// Schéma pour créer une association
export const createAssociationSchema = baseAssociationSchema.extend({
  details: z.array(associationDetailSchema).optional(),
})

// Schéma pour mettre à jour une association
export const updateAssociationSchema = baseAssociationSchema.partial().extend({
  details: z.array(associationDetailSchema).optional(),
})

// Types TypeScript
export type AssociationDetail = z.infer<typeof associationDetailSchema>
export type CreateAssociationInput = z.infer<typeof createAssociationSchema>
export type UpdateAssociationInput = z.infer<typeof updateAssociationSchema>

/**
 * Type d'une association lue dans un fichier d'import : la valeur du fichier
 * si elle est connue, sinon `undefined` (on ne touche pas au type existant ;
 * à la création, la valeur par défaut de la colonne s'applique). Les imports
 * ignoraient ce champ : une incompatibilité importée devenait favorable.
 */
export function typeAssociationImporte(type: unknown): AssociationType | undefined {
  return typeof type === "string" && (ASSOCIATION_TYPES as readonly string[]).includes(type)
    ? (type as AssociationType)
    : undefined
}
