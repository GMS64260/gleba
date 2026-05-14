/**
 * Étiquette PDF d'un lot fromage (PROMPT 17 §4).
 *
 * GET /api/elevage/lots-fromage/[id]/etiquette
 *
 * Format A6 paysage adapté pour impression sur étiquette autocollante.
 * Mentions obligatoires (Règl. UE 1169/2011 + Décret 2002-1098 fromages) :
 *   - Dénomination de vente (type, traitement thermique : "au lait cru")
 *   - Origine (raison sociale + n° agrément si applicable)
 *   - Numéro de lot (traçabilité paquet hygiène CE 178/2002 art. 18)
 *   - DLUO / DLC
 *   - Ingrédients principaux + allergènes (lait surligné)
 *   - Mention AB + organisme certificateur si applicable
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import PDFDocument from 'pdfkit'

interface Params {
  params: Promise<{ id: string }>
}

const TRAITEMENT_LABELS: Record<string, string> = {
  cru: 'au lait cru',
  thermise: 'au lait thermisé',
  pasteurise: 'au lait pasteurisé',
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { id } = await params

  const lot = await prisma.lotFromage.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!lot) return NextResponse.json({ error: 'Lot non trouvé' }, { status: 404 })

  const exploitation = await prisma.exploitation.findUnique({
    where: { userId: session.user.id },
  })

  // A6 paysage : 420×298 pt
  const doc = new PDFDocument({ size: [420, 298], margin: 16 })
  const chunks: Buffer[] = []
  const buffer: Buffer = await new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Bordure
    doc.rect(8, 8, 404, 282).strokeColor('#94a3b8').lineWidth(0.5).stroke()

    // Titre dénomination
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a')
    const denom = `${lot.typeFromage} ${TRAITEMENT_LABELS[lot.traitementThermique] || ''}`.trim()
    doc.text(denom, 20, 18, { width: 380 })

    // Origine
    let y = 50
    doc.font('Helvetica').fontSize(9).fillColor('#1e293b')
    if (exploitation) {
      doc.text(exploitation.raisonSociale, 20, y, { width: 380 })
      y += 11
      doc.fontSize(8).fillColor('#475569')
      doc.text(`${exploitation.adresseSiege} — ${exploitation.codePostal} ${exploitation.ville}`, 20, y, { width: 380 })
      y += 10
      if (lot.numeroAgrement) {
        doc.text(`N° agrément : ${lot.numeroAgrement}`, 20, y, { width: 380 })
        y += 10
      }
    }

    // Bloc lot / date / DLUO
    y = Math.max(y, 90)
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a')
    doc.text('Lot :', 20, y)
    doc.font('Helvetica').text(lot.numeroLot, 60, y)

    doc.font('Helvetica-Bold').text('Fab. :', 200, y)
    doc.font('Helvetica').text(formatDate(lot.dateFabrication), 240, y)

    y += 14
    if (lot.dluo) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a')
      doc.text('À consommer de préférence avant le', 20, y)
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#dc2626')
      doc.text(formatDate(lot.dluo), 220, y - 1)
      y += 16
    }

    // Ingrédients
    y += 6
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('Ingrédients', 20, y)
    y += 10
    doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
    const ingredients: string[] = []
    // Allergène lait en majuscule selon Règl. UE 1169/2011 annexe II
    const traitement = TRAITEMENT_LABELS[lot.traitementThermique] || lot.traitementThermique
    ingredients.push(`LAIT ${traitement.includes('cru') ? 'cru' : traitement.includes('thermisé') ? 'thermisé' : 'pasteurisé'}`)
    ingredients.push('sel', 'présure', 'ferments lactiques')
    if (lot.allergenes) ingredients.push(lot.allergenes)
    doc.text(ingredients.join(', '), 20, y, { width: 380 })

    // Bio
    y += 28
    if (lot.statutBioSnapshot === 'AB') {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#16a34a')
      doc.text('Issu de l\'agriculture biologique', 20, y)
      if (exploitation?.certifBioOrganisme) {
        y += 11
        doc.font('Helvetica').fontSize(8).fillColor('#475569')
        doc.text(`Certifié par ${exploitation.certifBioOrganisme}`, 20, y, { width: 380 })
      }
    } else if (lot.statutBioSnapshot && lot.statutBioSnapshot.startsWith('C')) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#65a30d')
      doc.text(`Produit en conversion vers l'AB (${lot.statutBioSnapshot})`, 20, y)
    }

    // Poids unitaire indicatif (poids total / nb pièces)
    const poidsUnitG = Math.round((Number(lot.poidsTotalKg) / lot.nbPieces) * 1000)
    doc.font('Helvetica').fontSize(8).fillColor('#475569')
    doc.text(`Poids net moyen : ${poidsUnitG} g — ${lot.nbPieces} pièce(s) du lot`, 20, 268, { width: 380 })

    doc.end()
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="etiquette-${lot.numeroLot}.pdf"`,
    },
  })
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
