/**
 * Registre sanitaire (PROMPT 19B §10).
 *
 * Liste chronologique des soins et traitements sur l'exercice.
 * Conservation 5 ans obligatoire (Code rural, art. L234-1 et suivants).
 *
 * GET /api/elevage/registre-sanitaire?year=2026
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import PDFDocument from 'pdfkit'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10)
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31, 23, 59, 59)

  const [soins, exploitation] = await Promise.all([
    prisma.soinAnimal.findMany({
      where: { userId: session.user.id, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
      include: {
        animal: { select: { id: true, nom: true, identifiant: true } },
        lot: { select: { id: true, nom: true } },
        produitVeterinaire: { select: { nom: true, substanceActive: true, amm: true } },
      },
    }),
    prisma.exploitation.findUnique({ where: { userId: session.user.id } }),
  ])

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 })
  const chunks: Buffer[] = []
  const buffer: Buffer = await new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // En-tête
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text('Registre sanitaire — soins et traitements', 30, 30)
    doc.font('Helvetica').fontSize(9).fillColor('#475569')
    doc.text(`Année ${year}`, 30, 52)
    if (exploitation) {
      doc.text(`${exploitation.raisonSociale} — SIRET ${exploitation.siret}`, 30, 64)
      doc.text(`${exploitation.adresseSiege}, ${exploitation.codePostal} ${exploitation.ville}`, 30, 76)
    }
    doc.fontSize(8).fillColor('#94a3b8').text('Conformité : Code rural art. L234-1 — conservation minimum 5 ans', 30, 96)

    // Colonnes
    const cols = {
      date: 30, type: 90, cible: 175, produit: 295, dose: 420, voie: 470, motif: 510,
      attLait: 620, attViande: 680, ord: 740, veto: 765,
    }
    let y = 120
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a')
    doc.text('Date', cols.date, y)
    doc.text('Type', cols.type, y)
    doc.text('Animal/Lot', cols.cible, y)
    doc.text('Produit (AMM)', cols.produit, y)
    doc.text('Dose', cols.dose, y)
    doc.text('Voie', cols.voie, y)
    doc.text('Motif', cols.motif, y)
    doc.text('Att. lait', cols.attLait, y, { width: 50 })
    doc.text('Att. viande', cols.attViande, y, { width: 50 })
    doc.text('Ord.', cols.ord, y)
    doc.text('Vétérinaire', cols.veto, y)
    doc.moveTo(30, y + 12).lineTo(815, y + 12).strokeColor('#cbd5e1').lineWidth(0.5).stroke()
    y += 18

    doc.font('Helvetica').fontSize(7).fillColor('#1e293b')
    for (const s of soins) {
      if (y > 540) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 })
        y = 50
      }
      const cible = s.animal
        ? `${s.animal.identifiant || `#${s.animal.id}`}${s.animal.nom ? ` (${s.animal.nom})` : ''}`
        : s.lot
        ? `Lot ${s.lot.nom || `#${s.lot.id}`}`
        : '—'
      const produit = s.produitVeterinaire
        ? `${s.produitVeterinaire.nom}${s.produitVeterinaire.amm ? ` — ${s.produitVeterinaire.amm}` : ''}`
        : s.produit || ''

      doc.text(new Date(s.date).toLocaleDateString('fr-FR'), cols.date, y, { width: 55 })
      // Audit élevage 2026-06-11 — un soin planifié non réalisé ne doit pas
      // se présenter comme un traitement administré dans un document
      // d'inspection : on le marque explicitement.
      doc.text(s.fait ? s.type : `${s.type} (prévu)`, cols.type, y, { width: 80 })
      doc.text(cible, cols.cible, y, { width: 115 })
      doc.text(produit, cols.produit, y, { width: 120 })
      doc.text(s.dose || '', cols.dose, y, { width: 45 })
      doc.text(s.voie || '', cols.voie, y, { width: 35 })
      doc.text(s.motif || s.description || '', cols.motif, y, { width: 105 })
      doc.text(s.finAttenteLait ? new Date(s.finAttenteLait).toLocaleDateString('fr-FR') : '—', cols.attLait, y, { width: 55 })
      doc.text(s.finAttenteViande ? new Date(s.finAttenteViande).toLocaleDateString('fr-FR') : '—', cols.attViande, y, { width: 55 })
      doc.text(s.ordonnanceUrl ? '✓' : '', cols.ord, y, { width: 20 })
      doc.text(s.veterinaire || '', cols.veto, y, { width: 50 })
      y += 14
    }
    if (soins.length === 0) {
      doc.text('Aucun soin enregistré pour cet exercice.', 30, y)
    }
    doc.end()
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="registre-sanitaire-${year}.pdf"`,
    },
  })
}
