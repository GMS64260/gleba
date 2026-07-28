import { z } from "zod"
import { URL_FICHIER_JUSTIFICATIF } from "./fichier-justificatif"

export const TYPES_JUSTIFICATIF_EQUARRISSAGE = [
  "BON_ENLEVEMENT",
  "ATTESTATION",
  "RECU",
  "AUTRE",
] as const

export type TypeJustificatifEquarrissage =
  (typeof TYPES_JUSTIFICATIF_EQUARRISSAGE)[number]

export const LABELS_TYPE_JUSTIFICATIF_EQUARRISSAGE:
Record<TypeJustificatifEquarrissage, string> = {
  BON_ENLEVEMENT: "Bon d’enlèvement",
  ATTESTATION: "Attestation d’équarrissage",
  RECU: "Reçu de prise en charge",
  AUTRE: "Autre preuve de mortalité",
}

const texteOptionnel = (max: number) =>
  z.preprocess(
    (value) => value === "" ? null : value,
    z.string().trim().max(max).nullable().optional(),
  )

export const justificatifEquarrissageInputSchema = z.object({
  typeDocument: z.enum(TYPES_JUSTIFICATIF_EQUARRISSAGE),
  dateEnlevement: z.coerce.date(),
  animalIds: z.array(z.coerce.number().int().positive()).max(500).default([]),
  nombreAnimauxNonIdentifies: z.coerce.number().int().min(0).max(100_000).default(0),
  typeAnimauxNonIdentifies: texteOptionnel(200),
  reference: texteOptionnel(200),
  prestataire: texteOptionnel(200),
  fichierUrl: z.preprocess(
    (value) => value === "" ? null : value,
    z.string().trim().regex(
      URL_FICHIER_JUSTIFICATIF,
      "Le fichier doit provenir du stockage sécurisé de Gleba",
    ).nullable().optional(),
  ),
  nomFichier: texteOptionnel(255),
  notes: texteOptionnel(1000),
}).superRefine((data, ctx) => {
  const annee = data.dateEnlevement.getUTCFullYear()
  if (annee < 1990 || annee > new Date().getUTCFullYear() + 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dateEnlevement"],
      message: "Date d’enlèvement hors bornes",
    })
  }
  if (new Set(data.animalIds).size !== data.animalIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["animalIds"],
      message: "Un animal ne peut être rattaché qu’une fois au même bon",
    })
  }
  if (!data.animalIds.length && data.nombreAnimauxNonIdentifies === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["animalIds"],
      message: "Rattachez au moins une mortalité ou indiquez un effectif non identifié",
    })
  }
  if (data.nombreAnimauxNonIdentifies > 0 && !data.typeAnimauxNonIdentifies) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["typeAnimauxNonIdentifies"],
      message: "Le type ou le lot des animaux non identifiés est requis",
    })
  }
  if (!data.reference && !data.fichierUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reference"],
      message: "Ajoutez une référence de classement ou un fichier",
    })
  }
  if (data.fichierUrl && !data.nomFichier) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nomFichier"],
      message: "Nom du fichier requis",
    })
  }
  if (!data.fichierUrl && data.nomFichier) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nomFichier"],
      message: "Un nom de fichier ne peut pas être conservé sans fichier",
    })
  }
})

export const justificatifEquarrissageMutationSchema = z.object({
  id: z.string().trim().min(1).optional(),
  data: justificatifEquarrissageInputSchema,
})

export const justificatifEquarrissageArchiveSchema = z.object({
  id: z.string().trim().min(1),
  archived: z.boolean().default(true),
})
