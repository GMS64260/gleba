/**
 * GET /api/arbres/campagnes/[id]/export
 *
 * PROMPT DEV 2 Bug #7 — Export PDF "dossier campagne" pour montage dossier
 * d'aides PCAE / Plantons en Normandie / FEADER.
 *
 * Contenu :
 *   - Page 1 : informations générales (essence, porte-greffe, parcelle,
 *     surface, fournisseur, prix, statut, dates).
 *   - Page 2 : suivi de reprise (taux N+1/N+2/N+3, mortalité, regarnissage).
 *   - Page 3 : observations détaillées (tableau chronologique).
 *
 * Les pièces externes (devis pépinière scanné, attestation, plan parcellaire)
 * ne sont pas embarquées : l'utilisateur les ajoute manuellement au dossier.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import PDFDocument from "pdfkit"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { id } = await params
  const campagneId = parseInt(id, 10)
  if (Number.isNaN(campagneId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 })
  }

  const campagne = await prisma.campagnePlantation.findFirst({
    where: { id: campagneId, userId: session.user.id },
    include: {
      observations: { orderBy: { date: "asc" } },
      porteGreffe: { select: { nom: true } },
      parcelleGeo: { select: { nom: true, surface: true } },
      espece: { select: { id: true, nomLatin: true } },
    },
  })
  if (!campagne) {
    return NextResponse.json({ error: "Cohorte introuvable" }, { status: 404 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  })

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 })
    const chunks: Buffer[] = []
    doc.on("data", (c: Buffer) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    // ─── EN-TÊTE COMMUN ─────────────────────────────────────────────────
    const header = (title: string) => {
      doc.fontSize(16).fillColor("#0f172a").font("Helvetica-Bold").text(title, 40, 40)
      doc.fontSize(9).fillColor("#64748b").font("Helvetica")
      doc.text(
        `Exploitation : ${user?.name ?? user?.email ?? "—"} · Cohorte #${campagne.id}`,
        40,
        62
      )
      doc.text(
        `Document généré le ${new Date().toLocaleDateString("fr-FR")} via Gleba — gleba.fr`,
        40,
        74
      )
      doc.moveTo(40, 92).lineTo(doc.page.width - 40, 92).stroke("#cbd5e1")
    }

    // ─── PAGE 1 : INFOS GÉNÉRALES ───────────────────────────────────────
    header(`Dossier campagne « ${campagne.nom} »`)
    let y = 110
    doc.fontSize(11).fillColor("#0f172a").font("Helvetica-Bold").text("Informations générales", 40, y)
    y += 18

    const infos: [string, string | number | null | undefined][] = [
      ["Nature", campagne.nature ?? "—"],
      ["Type de formation", campagne.typeFormation ?? "—"],
      ["Espèce", campagne.espece?.id ?? campagne.essenceLibre ?? "—"],
      ["Nom latin", campagne.espece?.nomLatin ?? "—"],
      ["Variété / Provenance", campagne.varieteOuProvenance ?? "—"],
      ["Porte-greffe", campagne.porteGreffe?.nom ?? "—"],
      ["Conduite", campagne.conduite ?? "—"],
      ["Type de plant", campagne.typePlant ?? "—"],
      ["Label provenance", campagne.labelProvenance ?? "—"],
      ["Parcelle", campagne.parcelleGeo?.nom ?? "—"],
      ["Surface (ha)", campagne.surfaceHa ?? "—"],
      ["Nombre de plants", campagne.nombrePlants ?? "—"],
      ["Densité (plants/ha)", campagne.densitePlantsParHa ?? "—"],
      ["Écartement rang (m)", campagne.ecartementRang ?? "—"],
      ["Écartement plant (m)", campagne.ecartementPlant ?? "—"],
      ["Protection", campagne.protectionType ?? "—"],
      ["Pépinière", campagne.pepiniere ?? "—"],
      ["Prix unitaire (€)", campagne.prixUnitaire ?? "—"],
      ["Budget prévu (€)", campagne.budgetPrevu ?? "—"],
      ["Statut", campagne.statut],
      ["Date plantation prévue", campagne.datePlantationPrevue ? new Date(campagne.datePlantationPrevue).toLocaleDateString("fr-FR") : "—"],
      ["Date plantation réelle", campagne.datePlantationReelle ? new Date(campagne.datePlantationReelle).toLocaleDateString("fr-FR") : "—"],
    ]
    doc.fontSize(9).fillColor("#0f172a").font("Helvetica")
    for (const [label, val] of infos) {
      doc.font("Helvetica-Bold").text(`${label} : `, 50, y, { continued: true })
      doc.font("Helvetica").text(`${val ?? "—"}`)
      y += 14
    }
    if (campagne.objectifs) {
      y += 6
      doc.font("Helvetica-Bold").text("Objectifs : ", 50, y)
      y += 12
      doc.font("Helvetica").text(campagne.objectifs, 50, y, { width: doc.page.width - 100 })
      y += doc.heightOfString(campagne.objectifs, { width: doc.page.width - 100 }) + 8
    }
    if (campagne.notes) {
      doc.font("Helvetica-Bold").text("Notes : ", 50, y)
      y += 12
      doc.font("Helvetica").text(campagne.notes, 50, y, { width: doc.page.width - 100 })
    }

    // ─── PAGE 2 : SUIVI DE REPRISE ──────────────────────────────────────
    doc.addPage()
    header(`Suivi de reprise — « ${campagne.nom} »`)
    y = 110
    doc.fontSize(11).fillColor("#0f172a").font("Helvetica-Bold").text("Taux de reprise observés", 40, y)
    y += 18

    const reprises = [
      ["N+1", campagne.nbPlantsRepriseAn1, campagne.tauxRepriseAn1],
      ["N+2", campagne.nbPlantsRepriseAn2, campagne.tauxRepriseAn2],
      ["N+3", campagne.nbPlantsRepriseAn3, campagne.tauxRepriseAn3],
    ] as const

    doc.fontSize(10).fillColor("#0f172a").font("Helvetica")
    for (const [annee, nb, taux] of reprises) {
      const tauxColor = taux == null ? "#64748b" : taux >= 90 ? "#16a34a" : taux >= 70 ? "#ca8a04" : "#dc2626"
      doc.font("Helvetica-Bold").text(`${annee}`, 50, y, { continued: true })
      doc.font("Helvetica").text(
        ` : ${nb ?? "—"} plants vivants${taux != null ? ` — taux ${taux.toFixed(1)}%` : " — non observé"}`,
        { continued: false }
      )
      if (taux != null) {
        // Petite bar visuelle
        doc.rect(380, y + 2, 140, 8).stroke("#cbd5e1")
        doc.rect(380, y + 2, (140 * Math.min(taux, 100)) / 100, 8).fill(tauxColor)
      }
      doc.fillColor("#0f172a")
      y += 22
    }

    if (campagne.regarnissagePlanifie) {
      y += 4
      doc.fontSize(9).fillColor("#dc2626").font("Helvetica-Bold")
      doc.text(
        "⚠ Regarnissage planifié — taux de reprise inférieur à 90 %.",
        50,
        y
      )
      y += 16
    }
    if (campagne.regarnissageRealiseDate) {
      doc.fontSize(9).fillColor("#16a34a").font("Helvetica-Bold")
      doc.text(
        `✓ Regarnissage réalisé le ${new Date(campagne.regarnissageRealiseDate).toLocaleDateString("fr-FR")}.`,
        50,
        y
      )
      y += 16
    }

    if (campagne.mortaliteCauses && campagne.mortaliteCauses.length > 0) {
      y += 6
      doc.fontSize(10).fillColor("#0f172a").font("Helvetica-Bold").text("Causes de mortalité observées :", 50, y)
      y += 14
      doc.fontSize(9).font("Helvetica")
      doc.text(campagne.mortaliteCauses.join(" · "), 60, y, { width: doc.page.width - 120 })
      y += 16
    }

    // ─── PAGE 3 : OBSERVATIONS DÉTAILLÉES ───────────────────────────────
    if (campagne.observations.length > 0) {
      doc.addPage()
      header("Observations détaillées")
      y = 110
      doc.fontSize(11).fillColor("#0f172a").font("Helvetica-Bold").text(
        `${campagne.observations.length} observation(s) enregistrée(s)`,
        40,
        y
      )
      y += 18

      for (const obs of campagne.observations) {
        if (y + 80 > doc.page.height - 40) {
          doc.addPage()
          y = 40
        }
        doc.fontSize(9).fillColor("#0f172a").font("Helvetica-Bold")
        const dateStr = new Date(obs.date).toLocaleDateString("fr-FR")
        const tauxStr = obs.tauxReprise != null ? ` · Taux ${obs.tauxReprise.toFixed(1)}%` : ""
        doc.text(`${dateStr}${tauxStr}`, 50, y)
        y += 12
        doc.font("Helvetica").fontSize(8).fillColor("#334155")
        const ligne1 = [
          obs.nbVivants != null ? `${obs.nbVivants} vivants` : null,
          obs.nbMorts != null ? `${obs.nbMorts} morts` : null,
          obs.nbManquants != null ? `${obs.nbManquants} manquants` : null,
          obs.hauteurMoyenneCm != null ? `H. moy ${obs.hauteurMoyenneCm} cm` : null,
          obs.vigueur ? `Vigueur : ${obs.vigueur}` : null,
        ].filter(Boolean).join(" · ")
        if (ligne1) {
          doc.text(ligne1, 60, y)
          y += 10
        }
        if (obs.problemes) {
          doc.text(`Problèmes : ${obs.problemes}`, 60, y)
          y += 10
        }
        if (obs.notes) {
          doc.text(obs.notes, 60, y, { width: doc.page.width - 120 })
          y += doc.heightOfString(obs.notes, { width: doc.page.width - 120 }) + 4
        }
        y += 6
        doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke("#e2e8f0")
        y += 8
      }
    }

    // ─── PIED DE PAGE FINAL ─────────────────────────────────────────────
    doc.fontSize(7).fillColor("#94a3b8").font("Helvetica-Oblique")
    doc.text(
      "Pièces à joindre au dossier d'aides : devis pépinière, attestation labellisation (CTPS / Plant Bleu), plan parcellaire géoréférencé.",
      40,
      doc.page.height - 50,
      { width: doc.page.width - 80, align: "center" }
    )

    doc.end()
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dossier-campagne-${campagne.id}.pdf"`,
    },
  })
}
