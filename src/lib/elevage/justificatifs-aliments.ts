import { z } from "zod"
import { URL_FICHIER_JUSTIFICATIF } from "./fichier-justificatif"

export { URL_FICHIER_JUSTIFICATIF } from "./fichier-justificatif"

export const TYPES_JUSTIFICATIF_ALIMENT = [
  "FACTURE",
  "BON_LIVRAISON",
  "ETIQUETTE",
  "FICHE_TECHNIQUE",
  "AUTRE",
] as const

export type TypeJustificatifAliment = (typeof TYPES_JUSTIFICATIF_ALIMENT)[number]

export const LABELS_TYPE_JUSTIFICATIF_ALIMENT: Record<TypeJustificatifAliment, string> = {
  FACTURE: "Facture",
  BON_LIVRAISON: "Bon de livraison",
  ETIQUETTE: "Étiquette d’aliment",
  FICHE_TECHNIQUE: "Fiche technique",
  AUTRE: "Autre justificatif",
}

const texteOptionnel = (max: number) =>
  z.preprocess(
    (value) => value === "" ? null : value,
    z.string().trim().max(max).nullable().optional(),
  )

export const justificatifAlimentInputSchema = z.object({
  typeDocument: z.enum(TYPES_JUSTIFICATIF_ALIMENT),
  dateDocument: z.coerce.date(),
  alimentId: texteOptionnel(200),
  reference: texteOptionnel(200),
  fournisseur: texteOptionnel(200),
  numeroLot: texteOptionnel(120),
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
  const annee = data.dateDocument.getUTCFullYear()
  if (annee < 1990 || annee > new Date().getUTCFullYear() + 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dateDocument"],
      message: "Date du document hors bornes",
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

export const justificatifAlimentMutationSchema = z.object({
  id: z.string().trim().min(1).optional(),
  data: justificatifAlimentInputSchema,
})

export const justificatifAlimentArchiveSchema = z.object({
  id: z.string().trim().min(1),
  archived: z.boolean().default(true),
})
