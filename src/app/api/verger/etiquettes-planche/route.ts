/**
 * GET /api/verger/etiquettes-planche?ids=1,2,3,...
 *
 * PROMPT DEV 2 Bug #8 — Planche A4 d'étiquettes QR codes arbres.
 *
 * Format compatible Avery L4774 (105×148,5 mm = 4 par A4) en mode
 * 6 étiquettes par page (2 colonnes × 3 lignes, ~95×95 mm chacune).
 * Marche aussi pour découpe manuelle.
 *
 * Chaque étiquette contient :
 *   - nom + espèce + variété
 *   - QR code lien profond vers /verger/[id]
 *   - URL en clair sous le QR pour saisie manuelle d'urgence
 *
 * Si `ids` absent, génère pour tous les arbres fruitiers + petits fruits
 * de l'utilisateur (limite 60 pour éviter les PDF trop gros).
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import PDFDocument from "pdfkit"
import QRCode from "qrcode"

const ROWS = 3
const COLS = 2
const MAX_ARBRES = 60 // 10 pages d'étiquettes max

function getOrigin(request: NextRequest): string {
  return (
    (process.env.APP_URL && process.env.APP_URL.replace(/\/$/, "")) ||
    (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.replace(/\/$/, "")) ||
    request.headers.get("origin") ||
    `https://${request.headers.get("host") ?? "gleba.fr"}`
  )
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const idsParam = request.nextUrl.searchParams.get("ids")
  let ids: number[] = []
  if (idsParam) {
    ids = idsParam
      .split(",")
      .map((s) => parseInt(s, 10))
      .filter((n) => !Number.isNaN(n))
  }

  const where: Record<string, unknown> = { userId: session.user.id }
  if (ids.length > 0) {
    where.id = { in: ids.slice(0, MAX_ARBRES) }
  } else {
    where.type = { in: ["fruitier", "petit_fruit"] }
  }

  const arbres = await prisma.arbre.findMany({
    where,
    select: {
      id: true,
      nom: true,
      espece: true,
      variete: true,
      datePlantation: true,
    },
    orderBy: { id: "asc" },
    take: MAX_ARBRES,
  })

  if (arbres.length === 0) {
    return NextResponse.json({ error: "Aucun arbre à étiqueter" }, { status: 404 })
  }

  const origin = getOrigin(request)

  // Pré-générer les QR codes en parallèle.
  const qrBuffers = await Promise.all(
    arbres.map((a) =>
      QRCode.toBuffer(`${origin}/verger/${a.id}`, {
        type: "png",
        margin: 1,
        width: 200,
        color: { dark: "#0f172a", light: "#ffffff" },
      })
    )
  )

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 24 })
    const chunks: Buffer[] = []
    doc.on("data", (c: Buffer) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const pageW = doc.page.width - 48
    const pageH = doc.page.height - 48
    const cellW = pageW / COLS
    const cellH = pageH / ROWS
    const PER_PAGE = ROWS * COLS

    arbres.forEach((a, idx) => {
      const idxOnPage = idx % PER_PAGE
      if (idx > 0 && idxOnPage === 0) doc.addPage()
      const col = idxOnPage % COLS
      const row = Math.floor(idxOnPage / COLS)
      const x0 = 24 + col * cellW
      const y0 = 24 + row * cellH

      // Bordure (pointillés pour découpe).
      doc
        .rect(x0 + 4, y0 + 4, cellW - 8, cellH - 8)
        .dash(2, { space: 2 })
        .strokeColor("#cbd5e1")
        .lineWidth(0.5)
        .stroke()
        .undash()

      // Texte gauche
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#0f172a")
      doc.text(a.nom || `Arbre #${a.id}`, x0 + 14, y0 + 16, { width: cellW / 2 - 20 })

      doc.font("Helvetica").fontSize(9).fillColor("#334155")
      let textY = y0 + 40
      if (a.espece) {
        doc.text(a.espece, x0 + 14, textY, { width: cellW / 2 - 20 })
        textY += 12
      }
      if (a.variete) {
        doc.font("Helvetica-Oblique").text(a.variete, x0 + 14, textY, { width: cellW / 2 - 20 })
        doc.font("Helvetica")
        textY += 12
      }
      if (a.datePlantation) {
        doc.fontSize(8).fillColor("#64748b")
        doc.text(
          `Planté ${new Date(a.datePlantation).toLocaleDateString("fr-FR")}`,
          x0 + 14,
          textY,
          { width: cellW / 2 - 20 }
        )
      }

      // QR à droite (carré centré dans la moitié droite).
      const qrSize = Math.min(cellW / 2 - 24, cellH - 40)
      const qrX = x0 + cellW / 2 + (cellW / 2 - qrSize) / 2
      const qrY = y0 + (cellH - qrSize) / 2
      doc.image(qrBuffers[idx], qrX, qrY, { width: qrSize, height: qrSize })

      // URL sous le QR (très petite).
      doc.fontSize(6).fillColor("#94a3b8")
      doc.text(`/verger/${a.id}`, qrX, qrY + qrSize + 2, { width: qrSize, align: "center" })
    })

    doc.end()
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="etiquettes-arbres-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
