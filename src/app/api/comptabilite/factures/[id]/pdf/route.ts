/**
 * Génération PDF d'une facture / avoir / acompte (PROMPT 14C).
 * GET /api/comptabilite/factures/[id]/pdf
 *
 * Mentions légales émises (art. 242 nonies A CGI, art. L441-10 C. com.) :
 *  - SIRET & raison sociale émetteur
 *  - Adresse et coordonnées contact
 *  - N° TVA intracom le cas échéant
 *  - Régime de TVA (293 B si franchise)
 *  - Numéro de facture, date d'émission, date d'échéance
 *  - Total HT, ventilation TVA par taux, total TTC
 *  - Pénalités de retard, indemnité forfaitaire 40 €, escompte
 *  - IBAN/BIC si disponibles
 *  - Mention AB si lignes certifiées
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import PDFDocument from "pdfkit"
import { mentionABFacture, labelMentionAB } from "@/lib/statut-bio"
import { formatSiret, sirenFromSiret } from "@/lib/siret"
import { identifiantLegalAffichage, getTerritoire } from "@/lib/territoires"
import { symboleDevise } from "@/lib/format-utils"
import type { EmetteurSnapshot } from "@/lib/facture-utils"

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
      lignes: { orderBy: { ordre: "asc" } },
    },
  })

  if (!facture) {
    return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 })
  }

  // Snapshot émetteur : on prend celui figé sur la facture si présent,
  // sinon on fallback sur l'Exploitation courante (compat factures pré-14C).
  let emetteur = facture.emetteurSnapshot as EmetteurSnapshot | null
  if (!emetteur) {
    const exploitation = await prisma.exploitation.findUnique({
      where: { userId: session!.user.id },
    })
    if (exploitation) {
      emetteur = {
        raisonSociale: exploitation.raisonSociale,
        formeJuridique: exploitation.formeJuridique,
        territoire: exploitation.territoire,
        siret: exploitation.siret,
        siren: exploitation.siren,
        identifiantLegal: exploitation.identifiantLegal,
        devise: exploitation.devise,
        numeroTvaIntracom: exploitation.numeroTvaIntracom,
        regimeFiscal: exploitation.regimeFiscal,
        regimeTva: exploitation.regimeTva,
        adresseSiege: exploitation.adresseSiege,
        codePostal: exploitation.codePostal,
        ville: exploitation.ville,
        pays: exploitation.pays,
        emailContact: exploitation.emailContact,
        telContact: exploitation.telContact,
        capitalSocial: exploitation.capitalSocial ? Number(exploitation.capitalSocial) : null,
        rib: exploitation.rib,
        bic: exploitation.bic,
        banqueNom: exploitation.banqueNom,
        logoUrl: exploitation.logoUrl,
        certifBioOrganisme: exploitation.certifBioOrganisme,
        tauxPenalitesRetard: exploitation.tauxPenalitesRetard,
        indemniteRecouvrement: Number(exploitation.indemniteRecouvrement),
        tauxEscompte: exploitation.tauxEscompte,
      }
    }
  }

  // Génération PDF
  const doc = new PDFDocument({ size: "A4", margin: 50 })
  const chunks: Buffer[] = []

  const buffer: Buffer = await new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const typeLabel = TYPE_LABELS[facture.type] || facture.type.toUpperCase()

    // Outre-mer : devise, identifiant légal et libellé de taxe dépendent du
    // territoire de l'émetteur (cf src/lib/territoires.ts). Anciennes factures
    // sans ces champs : repli métropole (€, SIRET, TVA).
    const devise = emetteur?.devise || "EUR"
    const sym = symboleDevise(devise as "EUR" | "XPF")
    const identEmetteur = emetteur ? identifiantLegalAffichage(emetteur) : null
    const libelleTaxe = getTerritoire(emetteur?.territoire).libelleTaxe || "TVA"

    // ============================================================
    // EN-TÊTE : émetteur (gauche) + bloc facture (droite)
    // ============================================================
    doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(16)
    doc.text(emetteur?.raisonSociale || "—", 50, 50, { width: 280 })

    doc.font("Helvetica").fontSize(9).fillColor("#475569")
    let y = 72
    if (emetteur) {
      const formeLabel = emetteur.formeJuridique === "EI" ? "EI" : emetteur.formeJuridique
      doc.text(`${formeLabel}${emetteur.capitalSocial ? ` au capital de ${formatMontant(emetteur.capitalSocial, devise)} ${sym}` : ""}`, 50, y, { width: 280 })
      y += 12
      doc.text(emetteur.adresseSiege, 50, y, { width: 280 })
      y += 12
      doc.text(`${emetteur.codePostal} ${emetteur.ville}, ${emetteur.pays}`, 50, y, { width: 280 })
      y += 12
      if (identEmetteur) {
        doc.text(`${identEmetteur.label} : ${identEmetteur.valeur}`, 50, y, { width: 280 })
        y += 12
      }
      if (emetteur.numeroTvaIntracom) {
        doc.text(`TVA intra : ${emetteur.numeroTvaIntracom}`, 50, y, { width: 280 })
        y += 12
      }
      if (emetteur.emailContact) {
        doc.text(emetteur.emailContact, 50, y, { width: 280 })
        y += 12
      }
      if (emetteur.telContact) {
        doc.text(emetteur.telContact, 50, y, { width: 280 })
        y += 12
      }
    } else {
      doc.fillColor("#dc2626").text("⚠ Identité légale non configurée — /parametres/exploitation", 50, y, { width: 280 })
      y += 24
    }

    // Bloc facture (droite)
    doc
      .fontSize(24)
      .fillColor("#0d9488")
      .font("Helvetica-Bold")
      .text(typeLabel, 350, 50, { width: 200, align: "right" })
    doc.fontSize(10).fillColor("#1e293b").font("Helvetica-Bold")
    doc.text(`N° ${facture.numero}`, 350, 82, { width: 200, align: "right" })
    doc.font("Helvetica").fillColor("#475569").fontSize(9)
    doc.text(`Émise le ${formatDate(facture.date)}`, 350, 100, { width: 200, align: "right" })
    if (facture.dateEcheance) {
      doc.text(`Échéance ${formatDate(facture.dateEcheance)}`, 350, 113, { width: 200, align: "right" })
    }

    // Trait de séparation
    const headerEndY = Math.max(y, 145)
    doc
      .moveTo(50, headerEndY + 8)
      .lineTo(545, headerEndY + 8)
      .strokeColor("#e2e8f0")
      .lineWidth(1)
      .stroke()

    // ============================================================
    // DESTINATAIRE
    // ============================================================
    y = headerEndY + 22
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#64748b").text("FACTURÉ À", 50, y)
    y += 14
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1e293b")
    doc.text(facture.clientNom || "—", 50, y, { width: 250 })
    y += 14
    doc.font("Helvetica").fontSize(9).fillColor("#475569")
    if (facture.clientAdresse) {
      doc.text(facture.clientAdresse, 50, y, { width: 250 })
      y += 12
    }
    if (facture.client?.email) {
      doc.text(facture.client.email, 50, y, { width: 250 })
      y += 12
    }
    if (facture.client?.siret) {
      doc.text(`SIRET : ${formatSiret(facture.client.siret)}`, 50, y, { width: 250 })
      y += 12
    }
    if (facture.client?.tvaIntra) {
      doc.text(`TVA intra : ${facture.client.tvaIntra}`, 50, y, { width: 250 })
      y += 12
    }

    if (facture.objet) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#64748b").text("OBJET", 320, headerEndY + 22)
      doc.font("Helvetica").fontSize(10).fillColor("#1e293b").text(facture.objet, 320, headerEndY + 36, { width: 225 })
    }

    // ============================================================
    // TABLEAU LIGNES
    // ============================================================
    const tableTop = Math.max(y + 12, 270)
    // Colonnes : Désignation (50) | Qté (290) | PU HT (340) | TVA% (400) | HT (445) | TTC (505)
    const cols = {
      desc: 50,
      qte: 290,
      pu: 340,
      tva: 400,
      ht: 445,
      ttc: 505,
    }

    doc.rect(50, tableTop, 495, 22).fillColor("#0d9488").fill()
    doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
    doc.text("Désignation", cols.desc + 6, tableTop + 7)
    doc.text("Qté", cols.qte, tableTop + 7, { width: 45, align: "right" })
    doc.text("PU HT", cols.pu, tableTop + 7, { width: 55, align: "right" })
    doc.text("TVA", cols.tva, tableTop + 7, { width: 40, align: "right" })
    doc.text("Total HT", cols.ht, tableTop + 7, { width: 55, align: "right" })
    doc.text("Total TTC", cols.ttc, tableTop + 7, { width: 45, align: "right" })

    let ly = tableTop + 26
    doc.font("Helvetica").fontSize(9)

    for (const ligne of facture.lignes) {
      const desc = ligne.description + (ligne.statutBio ? `\n  ${ligne.statutBio}` : "")
      const descHeight = doc.heightOfString(desc, { width: 230 })
      const rowH = Math.max(18, descHeight + 4)

      if (ly + rowH > 720) {
        doc.addPage()
        ly = 50
      }

      doc.fillColor("#1e293b").text(desc, cols.desc + 6, ly, { width: 230 })
      doc.fillColor("#475569")
      doc.text(
        `${formatNumber(ligne.quantite)} ${ligne.unite || ""}`.trim(),
        cols.qte,
        ly,
        { width: 45, align: "right" }
      )
      doc.text(formatMontant(ligne.prixUnitaire), cols.pu, ly, { width: 55, align: "right" })
      doc.text(`${ligne.tauxTVA}%`, cols.tva, ly, { width: 40, align: "right" })
      doc.fillColor("#1e293b")
      doc.text(formatMontant(ligne.montantHT), cols.ht, ly, { width: 55, align: "right" })
      doc.text(formatMontant(ligne.montantTTC), cols.ttc, ly, { width: 45, align: "right" })

      ly += rowH + 4
      doc.moveTo(50, ly - 2).lineTo(545, ly - 2).strokeColor("#f1f5f9").lineWidth(0.5).stroke()
    }

    // ============================================================
    // VENTILATION TVA PAR TAUX
    // ============================================================
    if (ly > 600) {
      doc.addPage()
      ly = 50
    }
    ly += 12
    const totaux = (facture.totauxParTauxTva || {}) as Record<string, { ht: number; tva: number; ttc: number }>

    // Bloc gauche : récap TVA par taux
    if (Object.keys(totaux).length > 0) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#475569").text(`Récapitulatif ${libelleTaxe}`, 50, ly)
      doc.font("Helvetica").fontSize(9).fillColor("#475569")
      doc.text("Taux", 50, ly + 14, { width: 50, align: "left" })
      doc.text("Base HT", 100, ly + 14, { width: 70, align: "right" })
      doc.text(libelleTaxe, 170, ly + 14, { width: 70, align: "right" })
      let yt = ly + 26
      const sortedTaux = Object.keys(totaux).sort((a, b) => Number(a) - Number(b))
      for (const k of sortedTaux) {
        const t = totaux[k]
        doc.text(`${k} %`, 50, yt, { width: 50, align: "left" })
        doc.text(formatMontant(t.ht, devise), 100, yt, { width: 70, align: "right" })
        doc.text(formatMontant(t.tva, devise), 170, yt, { width: 70, align: "right" })
        yt += 12
      }
    }

    // Bloc droite : totaux
    doc.font("Helvetica").fontSize(10).fillColor("#475569")
    doc.text("Total HT", 350, ly, { width: 100, align: "right" })
    doc.fillColor("#1e293b").text(`${formatMontant(facture.totalHT, devise)} ${sym}`, 460, ly, { width: 85, align: "right" })

    ly += 16
    doc.fillColor("#475569").text(libelleTaxe, 350, ly, { width: 100, align: "right" })
    doc.fillColor("#1e293b").text(`${formatMontant(facture.totalTVA, devise)} ${sym}`, 460, ly, { width: 85, align: "right" })

    ly += 18
    doc.rect(350, ly - 4, 195, 26).fillColor("#0d9488").fill()
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11)
    doc.text("Net à payer TTC", 350, ly + 4, { width: 100, align: "right" })
    doc.text(`${formatMontant(facture.totalTTC, devise)} ${sym}`, 460, ly + 4, { width: 85, align: "right" })

    ly += 38
    doc.font("Helvetica").fontSize(9).fillColor("#475569")

    // Date d'échéance / conditions
    if (facture.dateEcheance) {
      doc.text(`Date d'échéance : ${formatDate(facture.dateEcheance)}`, 50, ly, { width: 495 })
      ly += 12
    }
    if (facture.conditionsPaiement) {
      doc.text(`Conditions de paiement : ${facture.conditionsPaiement}`, 50, ly, { width: 495 })
      ly += 12
    }

    // Statut payée / annulée
    if (facture.statut === "payee") {
      doc.fontSize(10).fillColor("#059669").font("Helvetica-Bold")
      doc.text(
        `✓ Payée le ${facture.datePaiement ? formatDate(facture.datePaiement) : ""}${
          facture.modePaiement ? ` — ${labelModePaiement(facture.modePaiement)}` : ""
        }`,
        50,
        ly,
        { width: 495 }
      )
      ly += 16
    } else if (facture.statut === "annulee") {
      doc.fontSize(11).fillColor("#dc2626").font("Helvetica-Bold").text("✗ FACTURE ANNULÉE", 50, ly)
      ly += 16
    }

    // ============================================================
    // MENTION AB (PROMPT 12)
    // ============================================================
    const mention = mentionABFacture(facture.lignes.map((l) => l.statutBio))
    const mentionLabel = labelMentionAB(mention)
    if (mentionLabel) {
      const isBio = mention.mode === "ab"
      const couleur = isBio ? "#16a34a" : mention.mode === "conversion" ? "#65a30d" : "#475569"
      doc.fontSize(9).fillColor(couleur).font(isBio ? "Helvetica-Bold" : "Helvetica")
      doc.text(`${isBio ? "🌱 " : ""}${mentionLabel}`, 50, ly, { width: 495 })
      if (isBio && emetteur?.certifBioOrganisme) {
        ly += 12
        doc.font("Helvetica").fontSize(9).fillColor("#475569")
        doc.text(`Certifié par ${emetteur.certifBioOrganisme}`, 50, ly, { width: 495 })
      }
      ly += 18
    }

    // ============================================================
    // MENTIONS LÉGALES OBLIGATOIRES — pied de page
    // ============================================================
    const mentions = facture.mentionsSpecifiques || []
    const footerY = Math.max(ly, 660)

    doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text("Mentions légales", 50, footerY, { width: 495 })
    let fy = footerY + 12
    doc.font("Helvetica").fontSize(8).fillColor("#64748b")

    if (mentions.includes("293b")) {
      doc.text("• TVA non applicable, art. 293 B du CGI.", 50, fy, { width: 495 })
      fy += 10
    }
    if (mentions.includes("exoneration")) {
      doc.text("• TVA non applicable.", 50, fy, { width: 495 })
      fy += 10
    }
    if (mentions.includes("escompte")) {
      const escompte = emetteur?.tauxEscompte || "néant"
      doc.text(`• Escompte pour règlement anticipé : ${escompte}.`, 50, fy, { width: 495 })
      fy += 10
    }
    if (mentions.includes("penalites")) {
      const tx = emetteur?.tauxPenalitesRetard || "3 × taux légal"
      doc.text(`• Pénalités de retard : ${tx} en cas de paiement après échéance (art. L441-10 C. com.).`, 50, fy, { width: 495 })
      fy += 10
    }
    if (mentions.includes("indemnite-40")) {
      const indemnite = emetteur?.indemniteRecouvrement ?? 40
      doc.text(`• Indemnité forfaitaire pour frais de recouvrement : ${formatMontant(indemnite, devise)} ${sym} (art. L441-10 C. com.).`, 50, fy, { width: 495 })
      fy += 10
    }
    if (facture.mentionsLegales) {
      doc.text(facture.mentionsLegales, 50, fy, { width: 495 })
      fy += 10
    }

    // Coordonnées bancaires
    if (emetteur?.rib) {
      fy += 4
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#475569").text("Règlement par virement", 50, fy, { width: 495 })
      fy += 10
      doc.font("Helvetica").fontSize(8).fillColor("#475569")
      const ibanLine = [emetteur.banqueNom, `IBAN ${emetteur.rib}`, emetteur.bic ? `BIC ${emetteur.bic}` : null]
        .filter(Boolean)
        .join(" — ")
      doc.text(ibanLine, 50, fy, { width: 495 })
      fy += 12
    }

    // Footer minimal
    doc
      .fontSize(7)
      .fillColor("#cbd5e1")
      .text(
        `Document généré le ${new Date().toLocaleDateString("fr-FR")} via Gleba — gleba.fr`,
        50,
        810,
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
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatMontant(n: number, devise: string = "EUR"): string {
  const decimals = devise === "XPF" ? 0 : 2
  return n.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
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
    prelevement: "Prélèvement",
  }
  return labels[m] || m
}
