/**
 * GET /api/verger/calendrier/export[?scope=mine|all]
 *
 * PROMPT DEV2 Bug #3 — Export PDF du calendrier d'entretien saisonnier verger.
 *
 * - Format A4 paysage, tableau Gantt 12 mois × N espèces.
 * - `scope=mine` (défaut) : seulement les espèces présentes chez l'user.
 * - `scope=all` : tous les profils du référentiel verger.
 *
 * Cohérence avec [[bordereau-recolte]] (Dev 1) : même en-tête exploitation
 * et même pied de page produit par Gleba.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import PDFDocument from "pdfkit"
import {
  TREE_CARE_PROFILES,
  findTreeCareProfile,
  type TreeCareProfile,
} from "@/lib/tree-care-calendar"

const TYPE_COLORS: Record<string, string> = {
  taille: "#9c27b0",
  traitement: "#ef4444",
  fertilisation: "#f59e0b",
  recolte: "#22c55e",
  greffe: "#10b981",
  autre: "#6b7280",
}

const TYPE_LABELS: Record<string, string> = {
  taille: "Taille",
  traitement: "Traitement",
  fertilisation: "Fertilisation",
  recolte: "Récolte",
  greffe: "Greffe",
  autre: "Autre",
}

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const scope = request.nextUrl.searchParams.get("scope") || "mine"
  const userId = session!.user.id

  // Sélection des profils selon scope.
  let profiles: TreeCareProfile[]
  if (scope === "all") {
    profiles = TREE_CARE_PROFILES
  } else {
    const arbres = await prisma.arbre.findMany({
      where: { userId },
      select: { espece: true },
    })
    const especesUniques = [...new Set(arbres.map((a) => a.espece).filter(Boolean))] as string[]
    const seen = new Set<string>()
    profiles = []
    for (const esp of especesUniques) {
      const p = findTreeCareProfile(esp)
      if (p && !seen.has(p.espece)) {
        seen.add(p.espece)
        profiles.push(p)
      }
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30 })
    const chunks: Buffer[] = []
    doc.on("data", (c: Buffer) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    // En-tête
    doc.fontSize(14).fillColor("#0f172a").font("Helvetica-Bold")
    doc.text("Calendrier d'entretien saisonnier — Verger", 30, 30)
    doc.fontSize(9).fillColor("#334155").font("Helvetica")
    doc.text(`Exploitation : ${user?.name ?? user?.email ?? "—"}`, 30, 50)
    doc.text(
      `Périmètre : ${scope === "all" ? "Référentiel complet" : "Mes espèces"} · ${profiles.length} profil(s)`,
      30,
      62
    )
    doc.text(
      `Exporté le ${new Date().toLocaleDateString("fr-FR")} via Gleba — gleba.fr`,
      30,
      74
    )

    // Tableau Gantt
    const startY = 95
    const pageWidth = doc.page.width - 60
    const especeColW = 130
    const monthW = (pageWidth - especeColW) / 12
    const rowH = 20

    // En-tête tableau
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a")
    doc.rect(30, startY, pageWidth, rowH).fill("#f1f5f9")
    doc.fillColor("#0f172a").text("Espèce", 35, startY + 6, { width: especeColW - 10 })
    for (let m = 0; m < 12; m++) {
      doc.text(
        MOIS[m],
        30 + especeColW + m * monthW,
        startY + 6,
        { width: monthW, align: "center" }
      )
    }

    // Lignes
    let y = startY + rowH
    doc.fontSize(8).font("Helvetica")
    for (const profile of profiles) {
      if (y + rowH > doc.page.height - 60) {
        doc.addPage()
        y = 40
      }
      // Espece
      doc.fillColor("#0f172a").font("Helvetica-Bold")
      doc.text(profile.espece, 35, y + 5, { width: especeColW - 10 })
      doc.font("Helvetica").fontSize(7).fillColor("#64748b")
      doc.text(profile.type.replace("_", " "), 35, y + 13, { width: especeColW - 10 })
      doc.fontSize(8).fillColor("#0f172a")

      // Mois colorés selon opérations
      for (let m = 1; m <= 12; m++) {
        const ops = profile.operations.filter((op) => {
          if (op.moisDebut <= op.moisFin) {
            return m >= op.moisDebut && m <= op.moisFin
          }
          return m >= op.moisDebut || m <= op.moisFin
        })
        const types = [...new Set(ops.map((o) => o.type))]
        if (types.length === 0) continue
        const cellX = 30 + especeColW + (m - 1) * monthW
        // Bandes empilées (max 3 visibles).
        const bandH = (rowH - 4) / Math.min(types.length, 3)
        for (let i = 0; i < Math.min(types.length, 3); i++) {
          doc.rect(cellX + 1, y + 2 + i * bandH, monthW - 2, bandH - 1).fill(TYPE_COLORS[types[i]] || "#6b7280")
        }
      }
      // Bordure
      doc.fillColor("#0f172a")
      doc.rect(30, y, pageWidth, rowH).stroke("#e2e8f0")
      y += rowH
    }

    // Légende
    y += 10
    if (y + 60 > doc.page.height - 40) {
      doc.addPage()
      y = 40
    }
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a")
    doc.text("Légende :", 30, y)
    y += 14
    doc.fontSize(8).font("Helvetica")
    let x = 30
    for (const [type, color] of Object.entries(TYPE_COLORS)) {
      doc.rect(x, y + 2, 10, 8).fill(color)
      doc.fillColor("#0f172a").text(TYPE_LABELS[type] || type, x + 14, y + 2)
      x += 90
    }

    // Mention Prunus (critique audit Marc).
    y += 24
    doc.fontSize(8).fillColor("#7c2d12").font("Helvetica-Oblique")
    doc.text(
      "⚠ Prunus (Cerisier, Prunier, Pêcher, Abricotier, Amandier) : aucune taille hivernale (gommose + chancre). Taille post-récolte et taille en vert juin-août uniquement.",
      30,
      y,
      { width: pageWidth }
    )

    doc.end()
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="calendrier-verger-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
