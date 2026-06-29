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
import { identifiantLegalAffichage } from "@/lib/territoires"

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
  // DEV3 #2 — filtres supplémentaires (méthode + recherche produit)
  const methodeFilter = sp.get("methode")
  const produitFilter = sp.get("produit")?.toLowerCase()

  const [user, exploitation, interventions, observations] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, certiphytoNum: true, certiphytoValidite: true },
    }),
    // DEV3 #2 — En-tête PDF avec raison sociale + SIRET + agrément Ecocert
    prisma.exploitation.findUnique({
      where: { userId },
      select: {
        raisonSociale: true,
        territoire: true,
        siret: true,
        identifiantLegal: true,
        adresseSiege: true,
        codePostal: true,
        ville: true,
        certifBioOrganisme: true,
      },
    }),
    prisma.intervention.findMany({
      where: {
        userId,
        type: "traitement_phyto",
        date: { gte: from, lte: to },
        ...(parcelleId ? { OR: [{ parcelleId }, { plancheId: parcelleId }] } : {}),
      },
      include: {
        produitPhytoRef: true,
        operateur: { select: { name: true, email: true } },
        user: { select: { name: true, email: true } },
        parcelle: { select: { id: true, nom: true } },
      },
      orderBy: { date: "asc" },
    }),
    // DEV3 #2 — Inclure les observations Santé & Phyto du Verger qui
    // contiennent désormais les mêmes champs réglementaires (cf migration
    // 20260514260100). Filtre : observations avec produit/méthode chimique.
    prisma.observationSante.findMany({
      where: {
        userId,
        date: { gte: from, lte: to },
        OR: [
          { methodeTraitement: { in: ["chimique_conventionnel", "chimique_cuivre", "biocontrole", "biologique_purin", "chimique", "biologique"] } },
          { produit: { not: null } },
          { numAMM: { not: null } },
        ],
        ...(parcelleId ? { parcelleId } : {}),
      },
      include: {
        arbre: { select: { id: true, nom: true, espece: true, variete: true } },
        operateur: { select: { name: true, email: true } },
        user: { select: { name: true, email: true } },
        parcelle: { select: { id: true, nom: true } },
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

  // Modèle ligne d'export normalisé + filtrage post-fetch par especeId/methode/produit.
  const lignesIntervention = interventions.map((i) => {
    const ref = i.produitPhytoRef
    const culture = i.cultureId ? cultureById.get(i.cultureId) : null
    const planche = culture?.planche ?? (i.plancheId ? plancheById.get(i.plancheId) : null)
    const arbre = i.arbreId ? arbreById.get(i.arbreId) : null
    const espece = culture?.espece.id ?? arbre?.espece ?? null
    const variete = culture?.variete?.id ?? arbre?.variete ?? null
    return {
      source: "intervention",
      date: i.date.toISOString().slice(0, 10),
      parcelle: i.parcelle?.nom ?? planche?.nom ?? null,
      espece,
      variete,
      surfaceHa: i.surfaceTraiteeHa ?? i.surfaceTraitee ?? null,
      cible: i.cibleTraitement ?? null,
      methode: ref?.classification ?? null,
      produit: ref?.nomCommercial ?? i.produitPhyto ?? null,
      amm: ref?.amm ?? i.numAMM ?? null,
      substance: ref?.substanceActive ?? null,
      classification: ref?.classification ?? null,
      autoriseAB: ref?.autoriseAB ?? null,
      dose: i.doseAppliquee != null ? `${i.doseAppliquee} ${i.uniteDose ?? ""}`.trim() : null,
      volumeBouillie: i.volumeBouillieLHa ?? null,
      volumeBouillieTotal: i.volumeBouillieLTotal ?? null,
      dar: i.dar ?? ref?.darJours ?? null,
      temperatureC: i.temperatureC ?? null,
      ventKmh: i.ventKmh ?? null,
      hygrometriePct: i.hygrometriePct ?? null,
      pluie24h: i.pluie24h,
      pluie24hMm: i.pluie24hMm ?? null,
      epiPortes: i.epiPortes,
      zntRespectee: i.zntRespectee,
      zntDistanceM: i.zntDistanceM ?? null,
      operateur: i.operateur?.name || i.operateur?.email || i.user.name || i.user.email,
      certiphytoNum: i.certiphytoNum ?? null,
      certiphytoValidite: i.certiphytoValidite?.toISOString().slice(0, 10) ?? null,
      justification: i.justification ?? null,
    }
  })

  const lignesObservation = observations.map((o) => ({
    source: "observation_sante",
    date: o.date.toISOString().slice(0, 10),
    parcelle: o.parcelle?.nom ?? null,
    espece: o.arbre?.espece ?? null,
    variete: o.arbre?.variete ?? null,
    surfaceHa: o.surfaceTraiteeHa ?? null,
    cible: o.diagnostic ?? o.symptome ?? null,
    methode: o.methodeTraitement ?? null,
    produit: o.produit ?? null,
    amm: o.numAMM ?? null,
    substance: null as string | null,
    classification: o.methodeTraitement ?? null,
    autoriseAB: null as boolean | null,
    dose: o.doseAppliquee != null ? `${o.doseAppliquee} ${o.uniteDose ?? ""}`.trim() : null,
    volumeBouillie: o.volumeBouillieLHa ?? null,
    volumeBouillieTotal: o.volumeBouillieLTotal ?? null,
    dar: o.dar ?? null,
    temperatureC: o.temperatureC ?? null,
    ventKmh: o.ventKmh ?? null,
    hygrometriePct: o.hygrometriePct ?? null,
    pluie24h: o.pluie24h,
    pluie24hMm: o.pluie24hMm ?? null,
    epiPortes: o.epiPortes,
    zntRespectee: o.zntRespectee,
    zntDistanceM: o.zntDistanceM ?? null,
    operateur: o.operateur?.name || o.operateur?.email || o.user.name || o.user.email,
    certiphytoNum: o.certiphytoNum ?? null,
    certiphytoValidite: null as string | null,
    justification: o.traitement ?? null,
  }))

  const lignes = [...lignesIntervention, ...lignesObservation]
    .filter((l) => !especeId || l.espece === especeId)
    .filter((l) => !methodeFilter || l.methode === methodeFilter)
    .filter((l) => !produitFilter || (l.produit?.toLowerCase().includes(produitFilter)))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (format === "csv") {
    return buildCsv(lignes, user, exploitation, from, to)
  }
  return buildPdf(lignes, user, exploitation, from, to)
}

type Exploitation = {
  raisonSociale: string
  territoire?: string | null
  siret: string | null
  identifiantLegal?: string | null
  adresseSiege: string
  codePostal: string
  ville: string
  certifBioOrganisme: string | null
} | null

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
  exploitation: Exploitation,
  from: Date,
  to: Date
): NextResponse {
  const headers = [
    "Date",
    "Parcelle",
    "Espèce",
    "Variété",
    "Surface traitée (ha)",
    "Cible",
    "Produit",
    "N° AMM",
    "Substance active",
    "Classification",
    "Autorisé AB",
    "Dose appliquée",
    "Volume bouillie (L/ha)",
    "Volume bouillie (L total)",
    "DAR (j)",
    "Température (°C)",
    "Vent (km/h)",
    "Hygrométrie (%)",
    "Pluie ±24h",
    "Pluie (mm)",
    "EPI portés",
    "ZNT respectée",
    "ZNT distance (m)",
    "Opérateur",
    "N° Certiphyto",
    "Validité Certiphyto",
    "Justification / Action",
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
        l.volumeBouillieTotal,
        l.dar,
        l.temperatureC,
        l.ventKmh,
        l.hygrometriePct,
        l.pluie24h === null || l.pluie24h === undefined ? null : l.pluie24h ? "Oui" : "Non",
        l.pluie24hMm,
        Array.isArray(l.epiPortes) ? (l.epiPortes as string[]).join("|") : null,
        l.zntRespectee === null || l.zntRespectee === undefined ? null : l.zntRespectee ? "Oui" : "Non",
        l.zntDistanceM,
        l.operateur,
        l.certiphytoNum,
        l.certiphytoValidite,
        l.justification,
      ]
        .map(escapeCsv)
        .join(";")
    )
  }

  // En-tête en haut du CSV : exploitation + SIRET + agrément + période
  const emetteur = exploitation?.raisonSociale || user?.name || user?.email || ""
  const ident = exploitation ? identifiantLegalAffichage(exploitation) : null
  const siret = ident ? ` (${ident.label} ${ident.valeur})` : ""
  const agrement = exploitation?.certifBioOrganisme ? ` — Certification : ${exploitation.certifBioOrganisme}` : ""
  const periode = `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`
  const header = [
    `Registre phytosanitaire — ${emetteur}${siret}${agrement}`,
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
  exploitation: Exploitation,
  from: Date,
  to: Date
): Promise<NextResponse> {
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 30,
      // bufferPages permet d'utiliser switchToPage() après tout le rendu
      // pour redessiner les footers avec la pagination "Page X / Y".
      bufferPages: true,
      info: {
        Title: `Registre phyto ${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`,
        Author: exploitation?.raisonSociale || user?.name || user?.email || "Gleba",
        Subject: "Registre des produits phytosanitaires - Arrêté 16/06/2009",
        Keywords: "registre,phytosanitaire,bio,traçabilité",
      },
    })
    const chunks: Buffer[] = []
    doc.on("data", (c) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    // DEV3 #2 — Numérotation de pages : on incrémente à chaque addPage et
    // on dessine le footer en fin pour tracer "Page X / Y". pdfkit ne supporte
    // pas la pagination dynamique en un seul pass : on garde une stratégie
    // par accumulation puis post-traitement via switchToPage.
    let totalPages = 1

    const drawFooter = (pageNum: number) => {
      const pageBottom = doc.page.height - 38
      doc
        .fontSize(7)
        .fillColor("#64748b")
        .font("Helvetica")
        .text(MENTION_LEGALE, 30, pageBottom, {
          width: doc.page.width - 60,
          align: "center",
        })
      doc.text(
        `Exporté le ${new Date().toLocaleDateString("fr-FR")} via Gleba — gleba.fr  ·  Page ${pageNum} / ${totalPages}`,
        30,
        pageBottom + 10,
        { width: doc.page.width - 60, align: "center" }
      )
    }

    // ── EN-TÊTE ──
    // Bloc émetteur enrichi : raison sociale, SIRET, agrément Ecocert/BV
    const expName = exploitation?.raisonSociale || user?.name || user?.email || "Émetteur"
    doc.fontSize(15).fillColor("#0f172a").font("Helvetica-Bold")
      .text("Registre phytosanitaire", 30, 30)
    doc.fontSize(10).fillColor("#0f172a").font("Helvetica-Bold")
      .text(expName, 30, 52)
    doc.fontSize(8.5).fillColor("#334155").font("Helvetica")
    if (exploitation) {
      doc.text(
        `${exploitation.adresseSiege} — ${exploitation.codePostal} ${exploitation.ville}`,
        30,
        67
      )
      {
        const ident = identifiantLegalAffichage(exploitation)
        if (ident) doc.text(`${ident.label} ${ident.valeur}`, 30, 79)
      }
      if (exploitation.certifBioOrganisme) {
        doc.fillColor("#047857").font("Helvetica-Bold")
        doc.text(`Agrément AB : ${exploitation.certifBioOrganisme}`, 30, 91)
        doc.fillColor("#334155").font("Helvetica")
      }
    } else {
      doc.text(user?.email || "", 30, 67)
    }

    if (user?.certiphytoNum) {
      doc.text(
        `Certiphyto opérateur : ${user.certiphytoNum}${
          user.certiphytoValidite
            ? ` (valide jusqu'au ${user.certiphytoValidite.toLocaleDateString("fr-FR")})`
            : ""
        }`,
        30,
        exploitation?.certifBioOrganisme ? 104 : 91
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
    const tableTop = exploitation ? 130 : 110
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
      // Page break (laisse de l'espace pour la zone signature en dernière page)
      if (y + rowHeight > doc.page.height - 55) {
        totalPages++
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

    // DEV3 #2 — Zone signature en bas de la dernière page (pour signature
    // manuscrite après impression, lors d'un contrôle DRAAF / Agence Bio).
    const signatureY = Math.max(y + 20, doc.page.height - 110)
    if (signatureY + 60 < doc.page.height - 30) {
      doc.fontSize(8.5).fillColor("#1e293b").font("Helvetica-Bold")
        .text("Certification du registre", 30, signatureY)
      doc.fontSize(7.5).fillColor("#334155").font("Helvetica")
        .text(
          "Je soussigné(e), responsable de l'exploitation, certifie que les informations consignées ci-dessus sont exactes et conformes à la réglementation en vigueur.",
          30,
          signatureY + 14,
          { width: doc.page.width - 60 }
        )
      // Cadres signature
      doc.fontSize(7).fillColor("#64748b")
      doc.text("Fait à : ____________________________", 30, signatureY + 40)
      doc.text("Le : ____________________________", 30, signatureY + 52)
      doc.text("Signature et cachet :", doc.page.width - 250, signatureY + 40)
      doc.rect(doc.page.width - 250, signatureY + 50, 220, 40).strokeColor("#94a3b8").lineWidth(0.5).stroke()
    }

    // DEV3 #2 — Pagination finale avec switchToPage : on (re-)dessine les
    // footers sur chaque page maintenant qu'on connaît `totalPages`.
    for (let p = 0; p < totalPages; p++) {
      doc.switchToPage(p)
      drawFooter(p + 1)
    }
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
