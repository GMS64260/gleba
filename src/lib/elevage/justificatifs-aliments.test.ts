import { describe, expect, it } from "vitest"
import {
  justificatifAlimentInputSchema,
  URL_FICHIER_JUSTIFICATIF,
} from "./justificatifs-aliments"

const base = {
  typeDocument: "FACTURE",
  dateDocument: "2026-07-26",
  alimentId: "foin",
  fournisseur: "Coopérative locale",
  numeroLot: "LOT-2026-07",
  notes: "",
}

describe("justificatifs d’aliments", () => {
  it("accepte une référence physique sans téléversement", () => {
    expect(justificatifAlimentInputSchema.safeParse({
      ...base,
      reference: "Classeur aliments 2026, pièce 18",
      fichierUrl: "",
      nomFichier: "",
    }).success).toBe(true)
  })

  it("accepte un fichier sécurisé avec son nom d’origine", () => {
    expect(justificatifAlimentInputSchema.safeParse({
      ...base,
      reference: "",
      fichierUrl: "/api/upload/justificatif/123e4567-e89b-42d3-a456-426614174000.pdf",
      nomFichier: "facture-foin.pdf",
    }).success).toBe(true)
  })

  it("refuse un document sans référence ni fichier", () => {
    expect(justificatifAlimentInputSchema.safeParse({
      ...base,
      reference: "",
      fichierUrl: "",
      nomFichier: "",
    }).success).toBe(false)
  })

  it("refuse une URL externe ou appartenant à une autre route", () => {
    expect(URL_FICHIER_JUSTIFICATIF.test("https://example.test/facture.pdf")).toBe(false)
    expect(justificatifAlimentInputSchema.safeParse({
      ...base,
      reference: "",
      fichierUrl: "https://example.test/facture.pdf",
      nomFichier: "facture.pdf",
    }).success).toBe(false)
  })

  it("rejette une date manifestement erronée", () => {
    expect(justificatifAlimentInputSchema.safeParse({
      ...base,
      dateDocument: "0206-07-26",
      reference: "Pièce 1",
    }).success).toBe(false)
  })
})
