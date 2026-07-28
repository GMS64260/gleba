export interface ColonnePdf<T> {
  titre: string
  x: number
  largeur: number
  valeur: (ligne: T) => string
  align?: "left" | "center" | "right"
}

export interface OptionsLignePdf {
  taillePolice?: number
  hauteurMin?: number
  hauteurMax?: number
  paddingVertical?: number
}

const texte = (value: string | null | undefined) => value || "—"

export function hauteurLignePdf<T>(
  doc: PDFKit.PDFDocument,
  ligne: T,
  colonnes: ColonnePdf<T>[],
  options: OptionsLignePdf = {},
) {
  const taillePolice = options.taillePolice ?? 7
  const hauteurMin = options.hauteurMin ?? 13
  const hauteurMax = options.hauteurMax ?? 38
  const paddingVertical = options.paddingVertical ?? 4
  doc.font("Helvetica").fontSize(taillePolice)

  const hauteurTexte = Math.max(
    ...colonnes.map((colonne) =>
      doc.heightOfString(texte(colonne.valeur(ligne)), {
        width: Math.max(8, colonne.largeur - 4),
        lineBreak: true,
      }),
    ),
  )
  return Math.min(hauteurMax, Math.max(hauteurMin, hauteurTexte + paddingVertical))
}

export function lignePdfEstTronquee<T>(
  doc: PDFKit.PDFDocument,
  ligne: T,
  colonnes: ColonnePdf<T>[],
  options: OptionsLignePdf = {},
) {
  const taillePolice = options.taillePolice ?? 7
  const hauteurMax = options.hauteurMax ?? 38
  const paddingVertical = options.paddingVertical ?? 4
  doc.font("Helvetica").fontSize(taillePolice)
  return colonnes.some((colonne) =>
    doc.heightOfString(texte(colonne.valeur(ligne)), {
      width: Math.max(8, colonne.largeur - 4),
      lineBreak: true,
    }) + paddingVertical > hauteurMax,
  )
}

export function dessinerEnteteTableauPdf<T>(
  doc: PDFKit.PDFDocument,
  colonnes: ColonnePdf<T>[],
  y: number,
) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#0f172a")
  for (const colonne of colonnes) {
    doc.text(colonne.titre, colonne.x, y, {
      width: colonne.largeur - 3,
      height: 20,
      ellipsis: true,
      lineBreak: true,
      align: colonne.align ?? "left",
    })
  }
  doc
    .moveTo(colonnes[0]?.x ?? 30, y + 20)
    .lineTo(
      (colonnes.at(-1)?.x ?? 30) + (colonnes.at(-1)?.largeur ?? 0),
      y + 20,
    )
    .strokeColor("#cbd5e1")
    .lineWidth(0.5)
    .stroke()
  return y + 25
}

export function dessinerLigneTableauPdf<T>(
  doc: PDFKit.PDFDocument,
  ligne: T,
  colonnes: ColonnePdf<T>[],
  y: number,
  options: OptionsLignePdf & { fond?: string } = {},
) {
  const hauteur = hauteurLignePdf(doc, ligne, colonnes, options)
  if (options.fond) {
    const debut = colonnes[0]?.x ?? 30
    const fin = (colonnes.at(-1)?.x ?? debut) + (colonnes.at(-1)?.largeur ?? 0)
    doc.rect(debut, y, fin - debut, hauteur).fillColor(options.fond).fill()
  }

  doc.font("Helvetica").fontSize(options.taillePolice ?? 7).fillColor("#1e293b")
  for (const colonne of colonnes) {
    doc.text(texte(colonne.valeur(ligne)), colonne.x, y + 2, {
      width: colonne.largeur - 3,
      height: hauteur - 4,
      ellipsis: true,
      lineBreak: true,
      align: colonne.align ?? "left",
    })
  }
  return y + hauteur
}
