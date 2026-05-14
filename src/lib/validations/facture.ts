/**
 * POSTREVIEW — Validation Zod facture (Sprint 3 review : bloquant validation manquante).
 */
import { z } from "zod"
import { caseInsensitiveEnum } from "./case-insensitive-enum"

const TAUX_TVA = [0, 2.1, 5.5, 10, 20] as const

const ligneSchema = z
  .object({
    description: z.string().min(1, "Description requise").max(500),
    quantite: z.coerce.number().min(0).default(1),
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
  .refine(
    (l) => {
      // Cohérence ht + tva ≈ ttc (tolérance arrondi 0.02)
      const calc = Math.round((l.montantHT + l.montantTVA) * 100) / 100
      return Math.abs(calc - l.montantTTC) <= 0.02
    },
    { message: "Cohérence HT + TVA = TTC violée", path: ["montantTTC"] }
  )

export const createFactureSchema = z
  .object({
    // DEV1 T1 — Résilient à la casse.
    type: caseInsensitiveEnum(["facture", "avoir", "acompte"] as const).optional().default("facture"),
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
    notes: z.string().max(5000).nullable().optional(),
    mentionsLegales: z.string().max(5000).nullable().optional(),
    lignes: z.array(ligneSchema).min(1, "Au moins une ligne requise"),
  })
  .refine(
    (f) => {
      // Cohérence : somme des lignes ≈ totaux globaux (tolérance 0.05 €)
      const sumHT = f.lignes.reduce((s, l) => s + l.montantHT, 0)
      const sumTTC = f.lignes.reduce((s, l) => s + l.montantTTC, 0)
      return Math.abs(sumHT - f.totalHT) <= 0.05 && Math.abs(sumTTC - f.totalTTC) <= 0.05
    },
    { message: "Totaux facture incohérents avec la somme des lignes", path: ["totalTTC"] }
  )

export type CreateFactureInput = z.infer<typeof createFactureSchema>
