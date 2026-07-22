import { NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import PDFDocument from 'pdfkit'

export async function GET() {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session.user.id
  const [animaux, lots, exploitation] = await Promise.all([
    prisma.animal.findMany({ where: { userId, statut: 'actif' }, orderBy: [{ especeAnimaleId: 'asc' }, { identifiant: 'asc' }], include: { especeAnimale: { select: { nom: true } }, raceAnimale: { select: { nom: true } }, lot: { select: { nom: true } }, mere: { select: { identifiant: true, nom: true } }, pere: { select: { identifiant: true, nom: true } } } }),
    prisma.lotAnimaux.findMany({ where: { userId, statut: 'actif', quantiteActuelle: { gt: 0 } }, orderBy: [{ especeAnimaleId: 'asc' }, { nom: 'asc' }], include: { especeAnimale: { select: { nom: true } }, animaux: { where: { statut: 'actif' }, select: { id: true } } } }),
    prisma.exploitation.findUnique({ where: { userId } }),
  ])
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 })
  const chunks: Buffer[] = []
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject)
    doc.font('Helvetica-Bold').fontSize(16).text('Inventaire complet du cheptel')
    doc.font('Helvetica').fontSize(9).fillColor('#475569').text(`Situation au ${new Date().toLocaleDateString('fr-FR')}`)
    if (exploitation) doc.text(`${exploitation.raisonSociale}${exploitation.numeroEde ? ` — EDE ${exploitation.numeroEde}` : ''}`)
    let y = 100
    const header = () => { doc.font('Helvetica-Bold').fillColor('#0f172a').text('Espèce', 30, y).text('Identifiant / nom', 110, y).text('Sexe', 255, y).text('Naissance', 305, y).text('Race', 370, y).text('Lot', 455, y).text('Mère', 550, y).text('Père', 665, y); y += 17; doc.font('Helvetica').fontSize(8) }
    header()
    for (const a of animaux) {
      if (y > 540) { doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 }); y = 40; header() }
      const mere = a.mere?.identifiant || a.mere?.nom || '—'; const pere = a.pere?.identifiant || a.pere?.nom || a.pereIdentifiant || '—'
      doc.text(a.especeAnimale.nom, 30, y, { width: 75 }).text(`${a.identifiant || `#${a.id}`}${a.nom ? ` (${a.nom})` : ''}`, 110, y, { width: 140 }).text(a.sexe || '—', 255, y, { width: 45 }).text(a.dateNaissance?.toLocaleDateString('fr-FR') || '—', 305, y, { width: 60 }).text(a.raceAnimale?.nom || a.race || '—', 370, y, { width: 80 }).text(a.lot?.nom || '—', 455, y, { width: 90 }).text(mere, 550, y, { width: 110 }).text(pere, 665, y, { width: 145 }); y += 14
    }
    y += 12; doc.font('Helvetica-Bold').fontSize(12).text('Animaux suivis par lot', 30, y); y += 20; doc.font('Helvetica').fontSize(9)
    const lotsAgreges = lots.filter(lot => lot.animaux.length === 0)
    for (const lot of lotsAgreges) { if (y > 540) { doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 }); y = 40 } doc.text(`${lot.especeAnimale.nom} — ${lot.nom || `Lot #${lot.id}`} : ${lot.quantiteActuelle} animal(aux)`, 30, y); y += 15 }
    if (!animaux.length && !lotsAgreges.length) doc.text('Aucun animal actif dans le cheptel.', 30, y)
    doc.end()
  })
  return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="inventaire-cheptel.pdf"' } })
}
