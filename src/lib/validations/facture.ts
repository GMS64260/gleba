/**
 * POSTREVIEW — Validation Zod facture (Sprint 3 review : bloquant validation manquante).
 */
import { z } from "zod"
import { champsArticleStock } from "@/lib/commercial/stock-types"
import { caseInsensitiveEnum } from "./case-insensitive-enum"

const TAUX_TVA = [0, 2.1, 5.5, 10, 20] as const

/** Catégorie de l'opération (facturation électronique, cadre BT-23) : biens, services ou les deux. */
export const CATEGORIES_OPERATION = ["biens", "services", "mixte"] as const
export type CategorieOperation = (typeof CATEGORIES_OPERATION)[number]

const texteCourt = (max: number) => z.string().trim().max(max).nullable().optional()

/** Notes / conditions d'une facture : imprimées sur le PDF et portées en BT-22. Même règle à la création et au PATCH d'un brouillon. */
export const notesFactureSchema = z.string().max(5000, "Notes : 5 000 caractères au plus").nullable()

/** Mentions de la réforme modifiables après émission : elles ne touchent ni montants ni numéro. */
export const mentionsFactureSchema = z.object({
  categorieOperation: caseInsensitiveEnum(CATEGORIES_OPERATION).optional(),
  dateLivraison: z.coerce.date().nullable().optional(),
  adresseLivraison: texteCourt(500),
  codePostalLivraison: texteCourt(10),
  villeLivraison: texteCourt(100),
  paysLivraison: texteCourt(100),
})

const ligneSchema = z
  .object({
    ...champsArticleStock,
    description: z.string().min(1, "Description requise").max(500),
    quantite: z.coerce.number().positive("La quantité doit être strictement positive").default(1),
    unite: z.string().max(20).optional().default("unité"),
    prixUnitaire: z.coerce.number().min(0),
    tauxTVA: z.coerce
      .number()
      .refine((v) => (TAUX_TVA as readonly number[]).includes(v), {
        message: "Taux TVA doit être 0, 2.1, 5.5, 10 ou 20 %",
      }),
    montantHT: z.coerce.number().min(0),
    montantTVA: z.coerce.number().min(0),
    montantTTC: z.coerce.number().min(0),
    statutBio: z.string().optional().nullable(),
  })
  .superRefine((l, ctx) => {
    const close = (a: number, b: number, tolerance = 0.02) => Math.abs(a - b) <= tolerance
    if (!close(l.quantite * l.prixUnitaire, l.montantHT)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Quantité × prix unitaire doit être égal au montant HT", path: ["montantHT"] })
    }
    if (!close(l.montantHT * l.tauxTVA / 100, l.montantTVA)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Le montant de TVA ne correspond pas au taux appliqué", path: ["montantTVA"] })
    }
    if (!close(l.montantHT + l.montantTVA, l.montantTTC)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cohérence HT + TVA = TTC violée", path: ["montantTTC"] })
    }
  })

export const createFactureSchema = z
  .object({
    // DEV1 T1 — Résilient à la casse.
    type: caseInsensitiveEnum(["facture", "avoir", "acompte"] as const).optional().default("facture"),
    cleCreationStock: z.string().uuid().optional(),
    clientId: z.coerce.number().int().positive().nullable().optional(),
    clientNom: z.string().max(200).optional(),
    clientAdresse: z.string().max(500).nullable().optional(),
    date: z.coerce.date().optional(),
    dateEcheance: z.coerce.date().nullable().optional(),
    objet: z.string().max(500).optional().default(""),
    totalHT: z.coerce.number().min(0),
    totalTVA: z.coerce.number().min(0),
    totalTTC: z.coerce.number().min(0),
    statut: caseInsensitiveEnum(["brouillon", "emise", "payee", "annulee"] as const).optional().default("emise"),
    modePaiement: z.string().max(50).nullable().optional(),
    factureOrigineId: z.coerce.number().int().positive().nullable().optional(),
    notes: notesFactureSchema.optional(),
    mentionsLegales: z.string().max(5000).nullable().optional(),
    // Facturation électronique, lot 1 : catégorie d'opération (défaut biens,
    // le cas général d'une ferme) et livraison (BT-72, BG-15).
    categorieOperation: caseInsensitiveEnum(CATEGORIES_OPERATION).optional().default("biens"),
    dateLivraison: z.coerce.date().nullable().optional(),
    adresseLivraison: texteCourt(500),
    codePostalLivraison: texteCourt(10),
    villeLivraison: texteCourt(100),
    paysLivraison: texteCourt(100),
    lignes: z.array(ligneSchema).min(1, "Au moins une ligne requise"),
  })
  .refine(
    (f) => {
      // Cohérence : somme des lignes ≈ totaux globaux (tolérance 0.05 €)
      const sumHT = f.lignes.reduce((s, l) => s + l.montantHT, 0)
      const sumTVA = f.lignes.reduce((s, l) => s + l.montantTVA, 0)
      const sumTTC = f.lignes.reduce((s, l) => s + l.montantTTC, 0)
      return Math.abs(sumHT - f.totalHT) <= 0.05 && Math.abs(sumTVA - f.totalTVA) <= 0.05 && Math.abs(sumTTC - f.totalTTC) <= 0.05
    },
    { message: "Totaux facture incohérents avec la somme des lignes", path: ["totalTTC"] }
  )

export type CreateFactureInput = z.infer<typeof createFactureSchema>
