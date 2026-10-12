import { describe, expect, it } from "vitest"
import { attacherFacturX, creerDocumentPdfA3, terminerPdf } from "@/lib/facturx/pdfa"

describe("PDF/A-3 Factur-X (pdfkit)", () => {
  it("déclare PDF/A-3b et l'extension Factur-X, incorpore les polices et le XML en relation Data", async () => {
    const doc = creerDocumentPdfA3({ titre: "FACTURE F-2026-0001", auteur: "Ferme & Fils" })
    const xml = '<?xml version="1.0" encoding="UTF-8"?><rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"/>'
    const pdf = await terminerPdf(doc, () => {
      doc.font("Helvetica-Bold").fontSize(14).text("Facture F-2026-0001 ✓")
      doc.font("Helvetica").fontSize(10).text("Total TTC 21,10 €")
      attacherFacturX(doc, xml, "EN 16931")
    })
    const texte = pdf.toString("latin1")
    expect(texte.startsWith("%PDF-1.7")).toBe(true)
    expect(texte).toContain("<pdfaid:part>3</pdfaid:part>")
    expect(texte).toContain("<pdfaid:conformance>B</pdfaid:conformance>")
    expect(texte).toContain("<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>")
    expect(texte).toContain("<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>")
    expect(texte).toContain("/AFRelationship /Data")
    expect(texte).toContain("/OutputIntents")
    // Polices TrueType incorporées, aucune police standard non incorporée.
    expect(texte).toContain("/FontFile2")
    expect(texte).not.toMatch(/\/BaseFont \/Helvetica/)
  })
})
