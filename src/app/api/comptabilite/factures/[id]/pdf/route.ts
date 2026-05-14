/**
 * Génération PDF d'une facture / avoir / acompte.
 * GET /api/comptabilite/factures/[id]/pdf
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import PDFDocument from "pdfkit"
import { mentionABFacture, labelMentionAB } from "@/lib/statut-bio"

interface Params {
  params: Promise<{ id: string }>
}

const TYPE_LABELS: Record<string, string> = {
  facture: "FACTURE",
  avoir: "AVOIR",
  acompte: "ACOMPTE",
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { id } = await params
  const factureId = parseInt(id, 10)
  if (isNaN(factureId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 })
  }

  const facture = await prisma.facture.findFirst({
    where: { id: factureId, userId: session!.user.id },
    include: {
      client: true,
      lignes: { orderBy: { id: "asc" } },
    },
  })

  if (!facture) {
    return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 })
  }

  // Récupère les infos émetteur depuis l'utilisateur connecté
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { name: true, email: true },
  })

  // Génération PDF
  const doc = new PDFDocument({ size: "A4", margin: 50 })
  const chunks: Buffer[] = []

  const buffer: Buffer = await new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    // === EN-TÊTE ===
    const typeLabel = TYPE_LABELS[facture.type] || facture.type.toUpperCase()
    doc
      .fontSize(26)
      .fillColor("#0d9488")
      .text(typeLabel, 50, 50)
      .fontSize(11)
      .fillColor("#64748b")
      .text(`N° ${facture.numero}`, 50, 82)
      .text(`Date : ${formatDate(facture.date)}`, 50, 97)
      .text(`Échéance : ${facture.dateEcheance ? formatDate(facture.dateEcheance) : "—"}`, 50, 112)

    // Bloc émetteur (haut droit)
    doc
      .fontSize(11)
      .fillColor("#1e293b")
      .text(user?.name || user?.email || "Émetteur", 350, 50, { width: 200, align: "right" })
      .fillColor("#64748b")
      .fontSize(9)
      .text(user?.email || "", 350, 67, { width: 200, align: "right" })

    // Ligne séparation
    doc
      .moveTo(50, 145)
      .lineTo(545, 145)
      .strokeColor("#e2e8f0")
      .lineWidth(1)
      .stroke()

    // === DESTINATAIRE ===
    doc
      .fontSize(10)
      .fillColor("#64748b")
      .text("Destinataire", 50, 165)
      .fontSize(12)
      .fillColor("#1e293b")
      .text(facture.clientNom || "—", 50, 180, { width: 240 })

    if (facture.clientAdresse) {
      doc
        .fontSize(10)
        .fillColor("#475569")
        .text(facture.clientAdresse, 50, 198, { width: 240 })
    }

    if (facture.client?.email) {
      doc
        .fontSize(9)
        .fillColor("#64748b")
        .text(facture.client.email, 50, 230, { width: 240 })
    }

    if (facture.objet) {
      doc
        .fontSize(10)
        .fillColor("#64748b")
        .text("Objet", 320, 165)
        .fontSize(11)
        .fillColor("#1e293b")
        .text(facture.objet, 320, 180, { width: 225 })
    }

    // === TABLEAU LIGNES ===
    const tableTop = 280
    const colDesignation = 50
    const colQte = 320
    const colPU = 365
    const colTVA = 425
    const colTotal = 480

    // En-tête tableau
    doc
      .rect(50, tableTop, 495, 22)
      .fillColor("#f1f5f9")
      .fill()
    doc
      .fillColor("#1e293b")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Désignation", colDesignation + 8, tableTop + 7)
      .text("Qté", colQte, tableTop + 7, { width: 40, align: "right" })
      .text("PU HT", colPU, tableTop + 7, { width: 55, align: "right" })
      .text("TVA", colTVA, tableTop + 7, { width: 50, align: "right" })
      .text("Total HT", colTotal, tableTop + 7, { width: 60, align: "right" })

    let y = tableTop + 30
    doc.font("Helvetica").fontSize(10)

    for (const ligne of facture.lignes) {
      const descHeight = doc.heightOfString(ligne.description, {
        width: 260,
      })
      const rowHeight = Math.max(20, descHeight + 5)

      // Si overflow page → nouvelle page
      if (y + rowHeight > 720) {
        doc.addPage()
        y = 50
      }

      doc
        .fillColor("#1e293b")
        .text(ligne.description, colDesignation + 8, y, { width: 260 })
        .fillColor("#475569")
        .text(
          `${formatNumber(ligne.quantite)}${ligne.unite ? " " + ligne.unite : ""}`,
          colQte,
          y,
          { width: 40, align: "right" }
        )
        .text(formatMontant(ligne.prixUnitaire), colPU, y, { width: 55, align: "right" })
        .text(`${ligne.tauxTVA}%`, colTVA, y, { width: 50, align: "right" })
        .fillColor("#1e293b")
        .text(formatMontant(ligne.montantHT), colTotal, y, { width: 60, align: "right" })

      y += rowHeight + 4

      // Ligne séparation entre lignes
      doc
        .moveTo(50, y - 2)
        .lineTo(545, y - 2)
        .strokeColor("#f1f5f9")
        .lineWidth(0.5)
        .stroke()
    }

    // === TOTAUX ===
    if (y > 650) {
      doc.addPage()
      y = 50
    }
    y += 15

    const totalsX = 350
    const labelsX = 355
    const valuesX = 480

    doc
      .fontSize(10)
      .fillColor("#64748b")
      .text("Total HT", labelsX, y)
      .fillColor("#1e293b")
      .text(formatMontant(facture.totalHT) + " €", valuesX, y, { width: 65, align: "right" })

    y += 18
    doc
      .fillColor("#64748b")
      .text("TVA", labelsX, y)
      .fillColor("#1e293b")
      .text(formatMontant(facture.totalTVA) + " €", valuesX, y, { width: 65, align: "right" })

    y += 22
    doc
      .rect(totalsX, y - 4, 195, 28)
      .fillColor("#0d9488")
      .fill()
    doc
      .fillColor("#ffffff")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Total TTC", labelsX, y + 4)
      .text(formatMontant(facture.totalTTC) + " €", valuesX, y + 4, { width: 65, align: "right" })

    y += 50

    // === MENTION AB (PROMPT 12 LOT B) ===
    const mention = mentionABFacture(facture.lignes.map((l) => l.statutBio))
    const mentionLabel = labelMentionAB(mention)
    if (mentionLabel) {
      const isBio = mention.mode === "ab"
      const couleur = isBio ? "#16a34a" : mention.mode === "conversion" ? "#65a30d" : "#475569"
      doc
        .fontSize(10)
        .fillColor(couleur)
        .font(isBio ? "Helvetica-Bold" : "Helvetica")
        .text(`${isBio ? "🌱 " : ""}${mentionLabel}`, 50, y, { width: 495 })
      // Si lot mixte, détail par ligne sous forme compacte
      if (mention.mode === "mixte") {
        const lignesAvecStatut = facture.lignes.filter((l) => l.statutBio)
        if (lignesAvecStatut.length > 0) {
          y += 14
          doc.fontSize(8).fillColor("#64748b").font("Helvetica")
          for (const l of lignesAvecStatut) {
            const txt = `• ${l.description.slice(0, 60)}${l.description.length > 60 ? "…" : ""} — ${l.statutBio}`
            doc.text(txt, 60, y, { width: 485 })
            y += 11
          }
        }
      }
      y += 22
    }

    // === STATUT ===
    if (facture.statut === "payee") {
      doc
        .fontSize(11)
        .fillColor("#059669")
        .font("Helvetica-Bold")
        .text(
          `✓ Payée le ${facture.datePaiement ? formatDate(facture.datePaiement) : ""}${
            facture.modePaiement ? ` — ${labelModePaiement(facture.modePaiement)}` : ""
          }`,
          50,
          y
        )
      y += 25
    } else if (facture.statut === "annulee") {
      doc
        .fontSize(11)
        .fillColor("#dc2626")
        .font("Helvetica-Bold")
        .text("✗ Facture annulée", 50, y)
      y += 25
    }

    // === MENTIONS LÉGALES ===
    if (facture.mentionsLegales) {
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#94a3b8")
        .text(facture.mentionsLegales, 50, Math.max(y, 700), {
          width: 495,
          align: "left",
        })
    }

    // === FOOTER ===
    doc
      .fontSize(8)
      .fillColor("#cbd5e1")
      .text(
        `Document généré le ${new Date().toLocaleDateString("fr-FR")} via Gleba — gleba.fr`,
        50,
        780,
        { width: 495, align: "center" }
      )

    doc.end()
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${facture.numero}.pdf"`,
      "Cache-Control": "no-cache",
    },
  })
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatMontant(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatNumber(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 3 })
}

function labelModePaiement(m: string): string {
  const labels: Record<string, string> = {
    especes: "Espèces",
    cheque: "Chèque",
    cb: "Carte bancaire",
    virement: "Virement",
  }
  return labels[m] || m
}
