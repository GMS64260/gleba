/**
 * Étiquette physique d'un arbre avec QR code (PROMPT 24 §6).
 *
 * GET /api/verger/[id]/etiquette
 *
 * Format A6 paysage à découper/plastifier. Le QR code lie vers
 * /verger/[id] (vue mobile / fiche complète).
 *
 * Utilise pdfkit + qrcode (PNG inline via toDataURL).
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import PDFDocument from "pdfkit"
import QRCode from "qrcode"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { id } = await params
  const arbreId = parseInt(id, 10)

  const arbre = await prisma.arbre.findFirst({
    where: { id: arbreId, userId: session.user.id },
    select: { id: true, nom: true, espece: true, variete: true, datePlantation: true, gpsLat: true, gpsLng: true },
  })
  if (!arbre) return NextResponse.json({ error: "Arbre non trouvé" }, { status: 404 })

  // POSTREVIEW Sprint 7 — URL canonique pour le QR. Origin du request est
  // spoofable et absent en GET same-origin ; on préfère APP_URL (env var
  // pour self-hosters), puis NEXTAUTH_URL, puis origin du request, puis
  // host header. Fallback final : gleba.fr (production).
  function originDeRequest(): string {
    const host = request.headers.get("host")
    const proto = request.headers.get("x-forwarded-proto") || "https"
    if (host) return `${proto}://${host}`
    return ""
  }
  const origin =
    (process.env.APP_URL && process.env.APP_URL.replace(/\/$/, "")) ||
    (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.replace(/\/$/, "")) ||
    request.headers.get("origin") ||
    originDeRequest() ||
    "https://gleba.fr"
  const url = `${origin}/verger/${arbreId}`

  // QR Code en PNG data URL
  const qrPngBuffer = await QRCode.toBuffer(url, {
    type: "png",
    margin: 1,
    width: 240,
    color: { dark: "#0f172a", light: "#ffffff" },
  })

  // A6 paysage : 420×298 pt
  const doc = new PDFDocument({ size: [420, 298], margin: 16 })
  const chunks: Buffer[] = []
  const buffer: Buffer = await new Promise((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    // Bordure
    doc.rect(6, 6, 408, 286).strokeColor("#94a3b8").lineWidth(0.5).stroke()

    // Texte gauche
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a")
    doc.text(arbre.nom || `Arbre #${arbre.id}`, 20, 22, { width: 200 })

    doc.font("Helvetica").fontSize(11).fillColor("#334155")
    let y = 50
    if (arbre.espece) {
      doc.text(`Espèce : ${arbre.espece}`, 20, y, { width: 200 })
      y += 16
    }
    if (arbre.variete) {
      doc.text(`Variété : ${arbre.variete}`, 20, y, { width: 200 })
      y += 16
    }
    if (arbre.datePlantation) {
      doc.text(`Plantation : ${new Date(arbre.datePlantation).toLocaleDateString("fr-FR")}`, 20, y, { width: 200 })
      y += 16
    }
    if (arbre.gpsLat != null && arbre.gpsLng != null) {
      doc.fontSize(8).fillColor("#64748b").text(
        `GPS ${arbre.gpsLat.toFixed(5)}, ${arbre.gpsLng.toFixed(5)}`,
        20,
        y,
        { width: 200 }
      )
      y += 14
    }

    // QR Code à droite (carré 140×140)
    doc.image(qrPngBuffer, 250, 70, { width: 140, height: 140 })

    // URL sous le QR
    doc.font("Helvetica").fontSize(7).fillColor("#475569").text(url, 250, 218, { width: 140, align: "center" })

    // Pied : marque Gleba
    doc.fontSize(7).fillColor("#94a3b8").text("Gleba — fiche arbre", 20, 274, { width: 380, align: "left" })

    doc.end()
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="etiquette-arbre-${arbreId}.pdf"`,
    },
  })
}
