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

// Une correction d'item décrit une différence ; elle n'écrit jamais dans le
// référentiel. Aucune FK, identité de propriétaire ou provenance n'est saisissable.
const texteOptionnel = (max: number) => z.string().trim().max(max).transform(v => v || null).nullable().optional()
const nomCorrection = z.string().trim().min(1).max(200).optional()
const semaineCorrection = z.number().int().min(1).max(52).nullable().optional()
export const changementsEspeceSchema = z.object({
  nom: nomCorrection, nomLatin: texteOptionnel(200), description: texteOptionnel(12000), vivace: z.boolean().optional(),
  besoinEau: z.number().min(1).max(5).nullable().optional(), irrigation: texteOptionnel(200),
  densite: z.number().min(0.01).max(100000).nullable().optional(),
  joursLevee: z.number().int().min(1).max(365).nullable().optional(), temperatureGerm: texteOptionnel(200),
  besoinFroid: z.enum(["aucun", "faible", "modere", "eleve"]).nullable().optional(), zonesAdaptees: texteOptionnel(500),
}).strict()
export const changementsVarieteSchema = z.object({
  nom: nomCorrection, bio: z.boolean().optional(), semaineFloraison: semaineCorrection, semaineRecolte: semaineCorrection,
  dureeFloraison: z.number().int().min(0).max(52).nullable().optional(), dureeRecolte: z.number().int().min(0).max(52).nullable().optional(),
  groupePollinisation: texteOptionnel(100), ploidie: texteOptionnel(100),
}).strict()
export const changementsItpSchema = z.object({
  nom: z.string().trim().min(1).max(100).optional(), typePlanche: texteOptionnel(50), modeDemarrage: texteOptionnel(50),
  semaineSemis: semaineCorrection, semainePlantation: semaineCorrection, semaineRecolte: semaineCorrection,
  zoneClimat: texteOptionnel(100),
}).strict()
const baseCorrection = {
  refId: z.string().min(1).max(400), empreinteBase: z.string().regex(/^[a-f0-9]{64}$/),
  source: contributionEncyclopedieSchema.shape.source, motif: z.string().trim().max(500).optional().transform(v => v || "Correction proposée depuis la fiche"),
  signature, acceptationLicence: contributionEncyclopedieSchema.shape.acceptationLicence,
}
export const correctionCibleeSchema = z.discriminatedUnion("cibleType", [
  z.object({ ...baseCorrection, cibleType: z.literal("ESPECE"), changements: changementsEspeceSchema }).strict(),
  z.object({ ...baseCorrection, cibleType: z.literal("VARIETE"), changements: changementsVarieteSchema }).strict(),
  z.object({ ...baseCorrection, cibleType: z.literal("ITP"), changements: changementsItpSchema }).strict(),
])
export type PropositionCorrectionCiblee = z.infer<typeof correctionCibleeSchema>
