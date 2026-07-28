import { describe, expect, it } from "vitest"
import PDFDocument from "pdfkit"
import {
  hauteurLignePdf,
  lignePdfEstTronquee,
  type ColonnePdf,
} from "./pdf-table"

describe("mise en page des tableaux PDF", () => {
  const colonnes: ColonnePdf<{ valeur: string }>[] = [{
    titre: "Valeur",
    x: 30,
    largeur: 100,
    valeur: (ligne) => ligne.valeur,
  }]

  it("plafonne les lignes longues et signale le besoin d'une annexe", () => {
    const doc = new PDFDocument()
    const ligne = { valeur: "Texte réglementaire très long ".repeat(80) }

    expect(hauteurLignePdf(doc, ligne, colonnes, { hauteurMax: 38 })).toBe(38)
    expect(lignePdfEstTronquee(doc, ligne, colonnes, { hauteurMax: 38 })).toBe(true)
    doc.end()
  })

  it("laisse les lignes courtes à leur hauteur minimale", () => {
    const doc = new PDFDocument()
    const ligne = { valeur: "Court" }

    expect(hauteurLignePdf(doc, ligne, colonnes, {
      hauteurMin: 13,
      hauteurMax: 38,
    })).toBe(13)
    expect(lignePdfEstTronquee(doc, ligne, colonnes, { hauteurMax: 38 })).toBe(false)
    doc.end()
  })
})
