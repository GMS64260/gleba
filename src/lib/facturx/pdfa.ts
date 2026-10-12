import path from "node:path"
import PDFDocument from "pdfkit"

/**
 * PDF/A-3 porteur d'un XML Factur-X. pdfkit 0.18 sait produire le sous-ensemble
 * PDF/A-3b (profil de sortie sRGB, métadonnées XMP) et attacher un fichier avec
 * sa relation `AF`. Ce que la norme exige en plus : des polices incorporées
 * (les quatorze polices standard ne le sont pas) et l'extension XMP Factur-X.
 * Les polices vivent dans `public/fonts/pdf/` (DejaVu Sans, licence Bitstream
 * Vera), copiées telles quelles dans l'image.
 */
export type ProfilFacturX = "MINIMUM" | "BASIC WL" | "BASIC" | "EN 16931" | "EXTENDED"

export const NOM_FICHIER_FACTURX = "factur-x.xml"

export const POLICES_PDF = {
  regulier: path.join(process.cwd(), "public", "fonts", "pdf", "DejaVuSans.ttf"),
  gras: path.join(process.cwd(), "public", "fonts", "pdf", "DejaVuSans-Bold.ttf"),
}

export interface MetaPdf {
  titre: string
  auteur?: string | null
  sujet?: string | null
}

/**
 * Document A4 en PDF/A-3b. Les appels existants `font("Helvetica")` et
 * `font("Helvetica-Bold")` du dessin de facture tombent sur DejaVu Sans,
 * incorporée : une police enregistrée sous un nom passe avant la police
 * standard du même nom.
 */
export function creerDocumentPdfA3(meta: MetaPdf): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    pdfVersion: "1.7",
    subset: "PDF/A-3b",
    font: POLICES_PDF.regulier,
    displayTitle: true,
    info: {
      Title: meta.titre,
      Author: meta.auteur || "Gleba",
      Subject: meta.sujet || meta.titre,
      Creator: "Gleba (gleba.fr)",
      Producer: "Gleba",
    },
  })
  doc.registerFont("Helvetica", POLICES_PDF.regulier)
  doc.registerFont("Helvetica-Bold", POLICES_PDF.gras)
  doc.registerFont("Helvetica-Oblique", POLICES_PDF.regulier)
  doc.registerFont("Helvetica-BoldOblique", POLICES_PDF.gras)
  return doc
}

/** Extension XMP Factur-X (schéma PDF/A déclaré, puis les quatre propriétés). */
export function metadonneesFacturX(profil: ProfilFacturX, nomFichier = NOM_FICHIER_FACTURX): string {
  const propriete = (nom: string, description: string) =>
    `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${nom}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${description}</pdfaProperty:description></rdf:li>`
  return (
    `<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">` +
    `<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">` +
    `<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>` +
    `<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>` +
    `<pdfaSchema:prefix>fx</pdfaSchema:prefix>` +
    `<pdfaSchema:property><rdf:Seq>` +
    propriete("DocumentFileName", "name of the embedded XML invoice file") +
    propriete("DocumentType", "INVOICE") +
    propriete("Version", "The actual version of the Factur-X XML schema") +
    propriete("ConformanceLevel", "The conformance level of the embedded Factur-X data") +
    `</rdf:Seq></pdfaSchema:property>` +
    `</rdf:li></rdf:Bag></pdfaExtension:schemas>` +
    `</rdf:Description>` +
    `<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">` +
    `<fx:DocumentType>INVOICE</fx:DocumentType>` +
    `<fx:DocumentFileName>${nomFichier}</fx:DocumentFileName>` +
    `<fx:Version>1.0</fx:Version>` +
    `<fx:ConformanceLevel>${profil}</fx:ConformanceLevel>` +
    `</rdf:Description>`
  )
}

/** Incorpore le XML (relation `Data`, nom imposé `factur-x.xml`) et déclare l'extension XMP. */
export function attacherFacturX(doc: PDFKit.PDFDocument, xmlCii: string, profil: ProfilFacturX = "EN 16931"): void {
  doc.appendXML(metadonneesFacturX(profil))
  const maintenant = new Date()
  // `relationship` (clé /AFRelationship) est géré par pdfkit 0.18 mais absent de ses types.
  const options: NonNullable<Parameters<PDFKit.PDFDocument["file"]>[1]> & { relationship: "Data" } = {
    name: NOM_FICHIER_FACTURX,
    type: "text/xml",
    description: "Factur-X invoice data",
    relationship: "Data",
    creationDate: maintenant,
    modifiedDate: maintenant,
  }
  doc.file(Buffer.from(xmlCii, "utf8"), options)
}

/** Ferme le document et renvoie les octets. */
export function terminerPdf(doc: PDFKit.PDFDocument, dessiner: () => void): Promise<Buffer> {
  const morceaux: Buffer[] = []
  return new Promise((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => morceaux.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(morceaux)))
    doc.on("error", reject)
    try {
      dessiner()
      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}
