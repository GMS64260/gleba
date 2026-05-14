/**
 * Carnet de saillies (PROMPT 18 §6).
 * Document exigible en contrôle bovin. Format PDF chronologique.
 *
 * GET /api/elevage/carnet-saillies?year=2026
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

  const [saillies, exploitation] = await Promise.all([
    prisma.saillie.findMany({
      where: { userId: session.user.id, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
      include: {
        femelle: { select: { id: true, nom: true, identifiant: true, race: true } },
        male: { select: { id: true, nom: true, identifiant: true, race: true } },
        miseBas: { select: { id: true, date: true, nombreNes: true, nombreVivants: true } },
      },
    }),
    prisma.exploitation.findUnique({ where: { userId: session.user.id } }),
  ])

  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const chunks: Buffer[] = []
  const buffer: Buffer = await new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // En-tête
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text('Carnet de saillies', 40, 40)
    doc.font('Helvetica').fontSize(10).fillColor('#475569')
    doc.text(`Exercice ${year}`, 40, 62)
    if (exploitation) {
      doc.text(`${exploitation.raisonSociale} — SIRET ${exploitation.siret}`, 40, 76)
      doc.text(`${exploitation.adresseSiege}, ${exploitation.codePostal} ${exploitation.ville}`, 40, 90)
    }
    doc.text(`Imprimé le ${new Date().toLocaleDateString('fr-FR')}`, 40, 104)

    // Tableau
    const headerY = 130
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a')
    const cols = { date: 40, type: 105, femelle: 170, male: 280, mb: 395, statut: 470, result: 510 }
    doc.text('Date', cols.date, headerY)
    doc.text('Type', cols.type, headerY)
    doc.text('Femelle', cols.femelle, headerY)
    doc.text('Mâle / IA', cols.male, headerY)
    doc.text('Mise-bas att.', cols.mb, headerY)
    doc.text('Statut', cols.statut, headerY)
    doc.text('Résultat', cols.result, headerY)
    doc.moveTo(40, headerY + 12).lineTo(555, headerY + 12).strokeColor('#cbd5e1').lineWidth(0.5).stroke()

    let y = headerY + 18
    doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
    for (const s of saillies) {
      if (y > 780) {
        doc.addPage()
        y = 50
      }
      const femelleStr = `${s.femelle.identifiant || `#${s.femelle.id}`}${s.femelle.nom ? ` (${s.femelle.nom})` : ''}`
      const maleStr = s.male
        ? `${s.male.identifiant || `#${s.male.id}`}${s.male.nom ? ` (${s.male.nom})` : ''}`
        : s.pereExterneRef || (s.agentInseminateur ? `IA ${s.agentInseminateur}` : '—')
      const resultStr = s.miseBas
        ? `${s.miseBas.nombreVivants}/${s.miseBas.nombreNes} le ${new Date(s.miseBas.date).toLocaleDateString('fr-FR')}`
        : ''

      doc.text(new Date(s.date).toLocaleDateString('fr-FR'), cols.date, y, { width: 60 })
      doc.text(s.type, cols.type, y, { width: 60 })
      doc.text(femelleStr, cols.femelle, y, { width: 105 })
      doc.text(maleStr, cols.male, y, { width: 110 })
      doc.text(new Date(s.dateMiseBasAttendue).toLocaleDateString('fr-FR'), cols.mb, y, { width: 70 })
      doc.text(s.statut, cols.statut, y, { width: 40 })
      doc.text(resultStr, cols.result, y, { width: 60 })
      y += 14
      doc.moveTo(40, y - 2).lineTo(555, y - 2).strokeColor('#f1f5f9').lineWidth(0.3).stroke()
    }

    if (saillies.length === 0) {
      doc.text('Aucune saillie enregistrée pour cet exercice.', 40, headerY + 18)
    }

    // Footer
    doc.fontSize(7).fillColor('#94a3b8').text(
      'Document attestant des saillies réalisées sur l\'exploitation. Conservation 5 ans minimum (Code rural).',
      40,
      810,
      { width: 515, align: 'center' }
    )

    doc.end()
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="carnet-saillies-${year}.pdf"`,
    },
  })
}
