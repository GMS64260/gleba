import { z } from "zod";

export const ORGANES_MEDIA = ["plante", "feuille", "fleur", "fruit", "graine", "ecorce", "autre"] as const;
export const LICENCES_MEDIA_MEMBRE = ["CC BY 4.0"] as const;
export const LICENCES_MEDIA_COMMONS = ["CC0 1.0", "CC BY 4.0", "CC BY-SA 4.0", "Domaine public"] as const;

export const contributionMediaSchema = z.object({
  organe: z.enum(ORGANES_MEDIA).default("plante"),
  description: z.string().trim().max(500).optional().default(""),
  auteur: z.string().trim().min(2).max(120),
  confirmationDroits: z.literal("true"),
  acceptationLicence: z.literal("true"),
});

export const importCommonsSchema = z.object({
  especeId: z.string().min(1).max(200),
  imageUrl: z.url().max(2000),
  miniatureUrl: z.url().max(2000).optional(),
  urlOrigine: z.url().max(2000),
  auteur: z.string().trim().min(1).max(200),
  licence: z.enum(LICENCES_MEDIA_COMMONS),
  urlLicence: z.url().max(1000),
  citation: z.string().trim().min(1).max(1000),
  organe: z.enum(ORGANES_MEDIA).default("plante"),
  description: z.string().trim().max(500).optional(),
  principale: z.boolean().default(false),
});

