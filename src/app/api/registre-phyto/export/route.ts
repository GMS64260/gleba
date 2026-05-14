/**
 * GET /api/registre-phyto/export?from=&to=&format=pdf|csv&parcelleId=&especeId=
 *
 * PROMPT 11 LOT C — Export du registre phyto pour contrôle DRAAF / Agence Bio.
 *
 * - PDF A4 paysage avec mentions légales en pied de page.
 * - CSV UTF-8 avec BOM, séparateur `;` (compatible Excel FR).
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import PDFDocument from "pdfkit"

type Format = "pdf" | "csv"

const MENTION_LEGALE =
  "Document généré conformément à l'arrêté du 16 juin 2009 modifié — Registre des produits phytosanitaires."

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const sp = request.nextUrl.searchParams
  const format = (sp.get("format") || "pdf").toLowerCase() as Format
  const fromStr = sp.get("from")
  const toStr = sp.get("to")
  const parcelleId = sp.get("parcelleId")
  const especeId = sp.get("especeId")

  const from = fromStr ? new Date(fromStr) : new Date(new Date().getFullYear(), 0, 1)
  const to = toStr ? new Date(toStr) : new Date(new Date().getFullYear(), 11, 31, 23, 59, 59)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Paramètres from/to invalides" }, { status: 400 })
  }
  if (format !== "pdf" && format !== "csv") {
    return NextResponse.json({ error: "Format invalide (pdf|csv)" }, { status: 400 })
  }

  const userId = session!.user.id

  const [user, interventions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, certiphytoNum: true, certiphytoValidite: true },
    }),
    prisma.intervention.findMany({
      where: {
        userId,
        type: "traitement_phyto",
        date: { gte: from, lte: to },
        ...(parcelleId ? { plancheId: parcelleId } : {}),
      },
      include: {
        produitPhytoRef: true,
        operateur: { select: { name: true, email: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { date: "asc" },
    }),
  ])

  // Lookups séparés pour culture/planche/arbre (le modèle Intervention n'a
  // pas de relations Prisma directes vers ces entités — cf route GET existante).
  const cultureIds = [...new Set(interventions.map((i) => i.cultureId).filter((x): x is number => x != null))]
  const plancheIds = [...new Set(interventions.map((i) => i.plancheId).filter((x): x is string => !!x))]
  const arbreIds = [...new Set(interventions.map((i) => i.arbreId).filter((x): x is number => x != null))]

  const [cultures, planches, arbres] = await Promise.all([
    cultureIds.length > 0
      ? prisma.culture.findMany({
          where: { id: { in: cultureIds } },
          include: { espece: { select: { id: true } }, variete: { select: { id: true } }, planche: { select: { nom: true } } },
        })
      : Promise.resolve([]),
    plancheIds.length > 0
      ? prisma.planche.findMany({ where: { id: { in: plancheIds } }, select: { id: true, nom: true } })
      : Promise.resolve([]),
    arbreIds.length > 0
      ? prisma.arbre.findMany({ where: { id: { in: arbreIds } }, select: { id: true, nom: true, espece: true, variete: true } })
      : Promise.resolve([]),
  ])

  const cultureById = new Map(cultures.map((c) => [c.id, c]))
  const plancheById = new Map(planches.map((p) => [p.id, p]))
  const arbreById = new Map(arbres.map((a) => [a.id, a]))

  // Modèle ligne d'export normalisé + filtrage post-fetch par especeId.
  const lignes = interventions
    .map((i) => {
      const ref = i.produitPhytoRef
      const culture = i.cultureId ? cultureById.get(i.cultureId) : null
      const planche = culture?.planche ?? (i.plancheId ? plancheById.get(i.plancheId) : null)
      const arbre = i.arbreId ? arbreById.get(i.arbreId) : null
      const espece = culture?.espece.id ?? arbre?.espece ?? null
      const variete = culture?.variete?.id ?? arbre?.variete ?? null
      return {
        date: i.date.toISOString().slice(0, 10),
        parcelle: planche?.nom ?? null,
        espece,
        variete,
        surfaceHa: i.surfaceTraitee ?? null,
        cible: i.cibleTraitement ?? null,
        produit: ref?.nomCommercial ?? i.produitPhyto ?? null,
        amm: ref?.amm ?? i.numAMM ?? null,
        substance: ref?.substanceActive ?? null,
        classification: ref?.classification ?? null,
        autoriseAB: ref?.autoriseAB ?? null,
        dose: i.doseAppliquee != null ? `${i.doseAppliquee} ${i.uniteDose ?? ""}`.trim() : null,
        volumeBouillie: i.volumeBouillieLHa ?? null,
        dar: i.dar ?? ref?.darJours ?? null,
        temperatureC: i.temperatureC ?? null,
        ventKmh: i.ventKmh ?? null,
        hygrometriePct: i.hygrometriePct ?? null,
        operateur: i.operateur?.name || i.operateur?.email || i.user.name || i.user.email,
        certiphytoNum: i.certiphytoNum ?? null,
        certiphytoValidite: i.certiphytoValidite?.toISOString().slice(0, 10) ?? null,
        justification: i.justification ?? null,
      }
    })
    .filter((l) => !especeId || l.espece === especeId)

  if (format === "csv") {
    return buildCsv(lignes, user, from, to)
  }
  return buildPdf(lignes, user, from, to)
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV — UTF-8 avec BOM, séparateur `;` (Excel FR)
// ─────────────────────────────────────────────────────────────────────────────

type Ligne = ReturnType<typeof slugRow>
function slugRow(_x: unknown) {
  // Utilitaire de typage uniquement.
  return {} as Record<string, string | number | boolean | null>
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  // Échappe `"` et entoure de `"` si nécessaire
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function buildCsv(
  lignes: Array<Record<string, unknown>>,
  user: { name: string | null; email: string; certiphytoNum: string | null; certiphytoValidite: Date | null } | null,
  from: Date,
  to: Date
): NextResponse {
  const headers = [
    "Date",
    "Parcelle",
    "Espèce",
    "Variété",
    "Surface (ha)",
    "Cible",
    "Produit",
    "N° AMM",
    "Substance active",
    "Classification",
    "Autorisé AB",
    "Dose appliquée",
    "Volume bouillie (L/ha)",
    "DAR (j)",
    "Température (°C)",
    "Vent (km/h)",
    "Hygrométrie (%)",
    "Opérateur",
    "Certiphyto",
    "Validité Certiphyto",
    "Justification",
  ]

  const rows: string[] = []
  rows.push(headers.join(";"))
  for (const l of lignes) {
    rows.push(
      [
        l.date,
        l.parcelle,
        l.espece,
        l.variete,
        l.surfaceHa,
        l.cible,
        l.produit,
        l.amm,
        l.substance,
        l.classification,
        l.autoriseAB === null ? null : l.autoriseAB ? "Oui" : "Non",
        l.dose,
        l.volumeBouillie,
        l.dar,
        l.temperatureC,
        l.ventKmh,
        l.hygrometriePct,
        l.operateur,
        l.certiphytoNum,
        l.certiphytoValidite,
        l.justification,
      ]
        .map(escapeCsv)
        .join(";")
    )
  }

  // En-tête en haut du CSV : raison sociale + période + mention
  const emetteur = user?.name || user?.email || ""
  const periode = `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`
  const header = [
    `Registre phytosanitaire — ${emetteur}`,
    `Période : ${periode}`,
    MENTION_LEGALE,
    "",
  ].map(escapeCsv).join("\r\n")

  const bom = "﻿"
  const body = bom + header + "\r\n" + rows.join("\r\n") + "\r\n"
  const filename = `registre-phyto-${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF — A4 paysage, tableau dense, mentions légales en pied de page
// ─────────────────────────────────────────────────────────────────────────────

async function buildPdf(
  lignes: Array<Record<string, unknown>>,
  user: { name: string | null; email: string; certiphytoNum: string | null; certiphytoValidite: Date | null } | null,
  from: Date,
  to: Date
): Promise<NextResponse> {
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30 })
    const chunks: Buffer[] = []
    doc.on("data", (c) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const drawFooter = () => {
      const pageBottom = doc.page.height - 25
      doc
        .fontSize(7)
        .fillColor("#64748b")
        .font("Helvetica")
        .text(MENTION_LEGALE, 30, pageBottom, {
          width: doc.page.width - 60,
          align: "center",
        })
      doc.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")} via Gleba — gleba.fr`, 30, pageBottom + 8, {
        width: doc.page.width - 60,
        align: "center",
      })
    }

    // ── EN-TÊTE ──
    doc.fontSize(14).fillColor("#0f172a").font("Helvetica-Bold")
      .text("Registre phytosanitaire", 30, 30)
    doc.fontSize(9).fillColor("#334155").font("Helvetica")
      .text(user?.name || user?.email || "Émetteur", 30, 52)
    doc.text(`Email : ${user?.email ?? "—"}`, 30, 65)
    if (user?.certiphytoNum) {
      doc.text(
        `Certiphyto : ${user.certiphytoNum}${user.certiphytoValidite ? ` (valide jusqu'au ${user.certiphytoValidite.toLocaleDateString("fr-FR")})` : ""}`,
        30,
        78
      )
    }
    doc.text(
      `Période : ${from.toLocaleDateString("fr-FR")} → ${to.toLocaleDateString("fr-FR")}`,
      doc.page.width - 250,
      52,
      { width: 220, align: "right" }
    )
    doc.text(`Lignes : ${lignes.length}`, doc.page.width - 250, 65, { width: 220, align: "right" })

    // ── TABLEAU ──
    const tableTop = 110
    const cols: Array<{ key: string; label: string; w: number }> = [
      { key: "date", label: "Date", w: 55 },
      { key: "parcelle", label: "Parcelle", w: 70 },
      { key: "espece", label: "Espèce/Var.", w: 70 },
      { key: "surfaceHa", label: "Surf.(ha)", w: 40 },
      { key: "cible", label: "Cible", w: 55 },
      { key: "produit", label: "Produit (AMM)", w: 110 },
      { key: "substance", label: "Substance", w: 80 },
      { key: "classification", label: "Classif.", w: 70 },
      { key: "dose", label: "Dose", w: 45 },
      { key: "volumeBouillie", label: "Bouillie", w: 40 },
      { key: "dar", label: "DAR", w: 25 },
      { key: "meteo", label: "Météo (T°/V/H)", w: 70 },
      { key: "operateur", label: "Opérateur (Certiphyto)", w: 80 },
      { key: "justification", label: "Justification", w: 60 },
    ]

    const drawHeader = (y: number): number => {
      doc.rect(30, y, doc.page.width - 60, 18).fillColor("#e2e8f0").fill()
      doc.fillColor("#1e293b").fontSize(7.5).font("Helvetica-Bold")
      let x = 30
      for (const c of cols) {
        doc.text(c.label, x + 2, y + 5, { width: c.w - 4 })
        x += c.w
      }
      return y + 18
    }

    let y = drawHeader(tableTop)
    doc.fontSize(7).font("Helvetica").fillColor("#1e293b")

    const formatRow = (l: Record<string, unknown>) => {
      const meteo = [l.temperatureC, l.ventKmh, l.hygrometriePct]
        .map((v, idx) => (v == null ? "—" : `${v}${idx === 0 ? "°C" : idx === 1 ? "km/h" : "%"}`))
        .join(" / ")
      const operateurCol = `${l.operateur ?? ""}${l.certiphytoNum ? ` (${l.certiphytoNum})` : ""}`
      const especeVar = [l.espece, l.variete].filter(Boolean).join(" — ") || "—"
      const produitAmm = `${l.produit ?? "—"}${l.amm ? ` (AMM ${l.amm})` : ""}`
      return {
        date: String(l.date ?? ""),
        parcelle: String(l.parcelle ?? "—"),
        espece: especeVar,
        surfaceHa: l.surfaceHa != null ? String(l.surfaceHa) : "—",
        cible: String(l.cible ?? "—"),
        produit: produitAmm,
        substance: String(l.substance ?? "—"),
        classification: String(l.classification ?? "—"),
        dose: String(l.dose ?? "—"),
        volumeBouillie: l.volumeBouillie != null ? String(l.volumeBouillie) : "—",
        dar: l.dar != null ? String(l.dar) : "—",
        meteo,
        operateur: operateurCol,
        justification: String(l.justification ?? "—"),
      }
    }

    for (const ligne of lignes) {
      const row = formatRow(ligne)
      // Hauteur dynamique : max sur les colonnes texte longues
      let rowHeight = 14
      for (const c of cols) {
        const txt = (row as Record<string, string>)[c.key] ?? ""
        const h = doc.heightOfString(txt, { width: c.w - 4 }) + 4
        if (h > rowHeight) rowHeight = h
      }
      // Page break
      if (y + rowHeight > doc.page.height - 50) {
        drawFooter()
        doc.addPage({ size: "A4", layout: "landscape", margin: 30 })
        y = drawHeader(30)
        doc.fontSize(7).font("Helvetica").fillColor("#1e293b")
      }

      let x = 30
      for (const c of cols) {
        const txt = (row as Record<string, string>)[c.key] ?? ""
        doc.text(txt, x + 2, y + 2, { width: c.w - 4 })
        x += c.w
      }
      // Séparateur
      doc.moveTo(30, y + rowHeight).lineTo(doc.page.width - 30, y + rowHeight).strokeColor("#e2e8f0").lineWidth(0.3).stroke()
      y += rowHeight
    }

    if (lignes.length === 0) {
      doc.fontSize(10).fillColor("#64748b")
        .text("Aucun traitement sur la période.", 30, y + 12)
    }

    drawFooter()
    doc.end()
  })

  const filename = `registre-phyto-${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.pdf`
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache",
    },
  })
}

// Évite un warning ESLint "_x defined but never used" sur slugRow.
void slugRow

// Type util pour le tooling.
export type RegistrePhytoLigne = Ligne
