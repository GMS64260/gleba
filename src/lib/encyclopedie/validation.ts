import { z } from "zod"
import { SECTIONS_ENCYCLOPEDIE, CATEGORIES_FORUM } from "./types"
const signature = z.string().trim().min(2, "Choisissez une signature publique.").max(80)
export const contributionEncyclopedieSchema = z.object({
  section: z.enum(SECTIONS_ENCYCLOPEDIE),
  contenu: z.string().trim().min(20, "Précisez un texte d'au moins 20 caractères.").max(12000),
  source: z.string().trim().min(5, "Indiquez une source vérifiable.").max(2000),
  motif: z.string().trim().min(3, "Expliquez votre modification.").max(500),
  signature,
  revisionBaseId: z.string().min(1).max(64).nullable().default(null),
  acceptationLicence: z.literal(true, { error: "L'acceptation de la licence CC BY 4.0 est nécessaire." }),
})
export const discussionEncyclopedieSchema = z.object({
  titre: z.string().trim().min(6).max(180), contenu: z.string().trim().min(3).max(4000), signature,
})
export const reponseEncyclopedieSchema = z.object({ contenu: z.string().trim().min(2).max(4000), signature })
export const decisionEncyclopedieSchema = z.object({
  decision: z.enum(["PUBLIER", "A_REPRENDRE", "REFUSER"]), motif: z.string().trim().min(3).max(1000),
})
export type PropositionEncyclopedie = z.infer<typeof contributionEncyclopedieSchema>
export type DecisionEncyclopedie = z.infer<typeof decisionEncyclopedieSchema>

export const sujetForumSchema = discussionEncyclopedieSchema.extend({
  categorie: z.enum(CATEGORIES_FORUM).default("GENERAL"), especeId: z.string().min(1).max(200).optional(),
})
export const modifierSujetForumSchema = z.object({ resolu: z.boolean().optional(), epingle: z.boolean().optional() })
  .refine(v => v.resolu !== undefined || v.epingle !== undefined, "Aucune modification indiquée.")
