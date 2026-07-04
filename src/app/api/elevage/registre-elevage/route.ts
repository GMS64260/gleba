/**
 * Registre d'élevage (PROMPT 19A §3).
 *
 * Arrêté du 5 juin 2000 (modifié 2018) : chaque éleveur doit tenir un
 * registre paginé chronologique des entrées et sorties d'animaux ou de
 * lots, présentable lors des inspections DDPP.
 *
 * GET /api/elevage/registre-elevage?year=2026
 *
 * Format : PDF A4 paysage, table à colonnes : Date | Type (Entrée/Sortie)
 *          | Espèce | ID animal | Lot | Origine | Destination | Motif.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import PDFDocument from 'pdfkit'
import { identifiantLegalAffichage } from '@/lib/territoires'

interface Ligne {
  date: Date
  sens: 'Entrée' | 'Sortie'
  espece: string
  ident: string
  lot: string
  origine: string
  destination: string
  motif: string
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10)
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31, 23, 59, 59)
  const userId = session.user.id

  const [entrees, sorties, lotsArrives, lotsTermine, abattagesLots, naissances, exploitation] = await Promise.all([
    prisma.animal.findMany({
      where: { userId, dateArrivee: { gte: start, lte: end } },
      include: { especeAnimale: { select: { nom: true } }, lot: { select: { id: true, nom: true } } },
      orderBy: { dateArrivee: 'asc' },
    }),
    prisma.animal.findMany({
      where: { userId, dateSortie: { gte: start, lte: end } },
      include: { especeAnimale: { select: { nom: true } }, lot: { select: { id: true, nom: true } } },
      orderBy: { dateSortie: 'asc' },
    }),
    prisma.lotAnimaux.findMany({
      where: { userId, dateArrivee: { gte: start, lte: end } },
      include: { especeAnimale: { select: { nom: true } } },
      orderBy: { dateArrivee: 'asc' },
    }),
    prisma.lotAnimaux.findMany({
      where: { userId, dateReforme: { gte: start, lte: end } },
      include: { especeAnimale: { select: { nom: true } } },
      orderBy: { dateReforme: 'asc' },
    }),
    // Audit élevage 2026-06-11 — les sorties PARTIELLES de lot (abattage de
    // 5 lapins sur 30) n'apparaissaient pas au registre : seuls les animaux
    // individuels (dateSortie) et la réforme complète du lot y figuraient.
    // Les abattages individuels (animalId) sont déjà couverts par la
    // dateSortie de l'animal — on n'ajoute que ceux rattachés à un lot.
    prisma.abattage.findMany({
      where: { userId, annule: false, lotId: { not: null }, date: { gte: start, lte: end } },
      include: {
        lot: { select: { id: true, nom: true, especeAnimale: { select: { nom: true } } } },
      },
      orderBy: { date: 'asc' },
    }),
    // Audit #23 : les naissances (surtout créditées sur un LOT existant, qui
    // ne créent pas d'animal individuel ni ne changent la dateArrivee du lot)
    // n'apparaissaient nulle part au registre → entrées manquantes.
    prisma.naissanceAnimale.findMany({
      where: { userId, date: { gte: start, lte: end } },
      include: {
        mere: { select: { especeAnimale: { select: { nom: true } }, nom: true, identifiant: true } },
        lot: { select: { nom: true, especeAnimale: { select: { nom: true } } } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.exploitation.findUnique({ where: { userId } }),
  ])

  const lignes: Ligne[] = []
  for (const a of entrees) {
    lignes.push({
      date: a.dateArrivee || a.createdAt,
      sens: 'Entrée',
      espece: a.especeAnimale?.nom || '—',
      ident: `${a.identifiant || `#${a.id}`}${a.nom ? ` (${a.nom})` : ''}`,
      lot: a.lot?.nom || '',
      origine: a.nExploitationOrigine || a.provenance || '',
      destination: '',
      motif: '',
    })
  }
  for (const n of naissances) {
    const espece = n.lot?.especeAnimale?.nom || n.mere?.especeAnimale?.nom || '—'
    const mereLabel = n.mere ? ` (mère : ${n.mere.nom || n.mere.identifiant || '—'})` : ''
    lignes.push({
      date: n.date,
      sens: 'Entrée',
      espece,
      ident: `Naissance ×${n.nombreVivants}${mereLabel}`,
      lot: n.lot?.nom || '',
      origine: 'Naissance',
      destination: '',
      motif: '',
    })
  }
  for (const a of sorties) {
    lignes.push({
      date: a.dateSortie!,
      sens: 'Sortie',
      espece: a.especeAnimale?.nom || '—',
      ident: `${a.identifiant || `#${a.id}`}${a.nom ? ` (${a.nom})` : ''}`,
      lot: a.lot?.nom || '',
      origine: '',
      destination: a.nExploitationDestination || '',
      motif: a.motifSortie || a.causeSortie || '',
    })
  }
  for (const l of lotsArrives) {
    lignes.push({
      date: l.dateArrivee || l.createdAt,
      sens: 'Entrée',
      espece: l.especeAnimale?.nom || '—',
      ident: `Lot #${l.id} (×${l.quantiteInitiale})`,
      lot: l.nom || `Lot #${l.id}`,
      origine: l.provenance || '',
      destination: '',
      motif: '',
    })
  }
  for (const l of lotsTermine) {
    lignes.push({
      date: l.dateReforme!,
      sens: 'Sortie',
      espece: l.especeAnimale?.nom || '—',
      ident: `Lot #${l.id} (×${l.quantiteActuelle})`,
      lot: l.nom || `Lot #${l.id}`,
      origine: '',
      destination: '',
      motif: 'Réforme',
    })
  }
  for (const a of abattagesLots) {
    lignes.push({
      date: a.date,
      sens: 'Sortie',
      espece: a.lot?.especeAnimale?.nom || '—',
      ident: `Lot #${a.lotId} (×${a.quantite})`,
      lot: a.lot?.nom || `Lot #${a.lotId}`,
      origine: '',
      destination: a.lieu === 'abattoir' ? 'Abattoir' : '',
      motif: `Abattage${a.destination === 'vente' ? ' (vente)' : a.destination === 'auto_consommation' ? ' (autoconsommation)' : a.destination === 'don' ? ' (don)' : ''}`,
    })
  }
  lignes.sort((a, b) => a.date.getTime() - b.date.getTime())

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 })
  const chunks: Buffer[] = []
  const buffer: Buffer = await new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // En-tête
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text("Registre d'élevage", 30, 30)
    doc.font('Helvetica').fontSize(9).fillColor('#475569')
    doc.text(`Année ${year}`, 30, 52)
    if (exploitation) {
      const identExpl = identifiantLegalAffichage(exploitation)
      doc.text(`${exploitation.raisonSociale}${identExpl ? ` — ${identExpl.label} ${identExpl.valeur}` : ""}`, 30, 64)
      doc.text(`${exploitation.adresseSiege}, ${exploitation.codePostal} ${exploitation.ville}`, 30, 76)
    }
    doc.text(`Imprimé le ${new Date().toLocaleDateString('fr-FR')}`, 30, 88)
    doc.fontSize(8).fillColor('#94a3b8').text("Conformité : arrêté du 5 juin 2000 — conservation minimum 5 ans", 30, 100)

    // Colonnes
    const cols = {
      date: 30,
      sens: 90,
      espece: 145,
      ident: 215,
      lot: 360,
      origine: 460,
      destination: 580,
      motif: 700,
    }
    let y = 120
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a')
    doc.text('Date', cols.date, y)
    doc.text('Sens', cols.sens, y)
    doc.text('Espèce', cols.espece, y)
    doc.text('Identifiant', cols.ident, y)
    doc.text('Lot', cols.lot, y)
    doc.text('Origine', cols.origine, y)
    doc.text('Destination', cols.destination, y)
    doc.text('Motif', cols.motif, y)
    doc.moveTo(30, y + 12).lineTo(815, y + 12).strokeColor('#cbd5e1').lineWidth(0.5).stroke()
    y += 18

    doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
    for (const l of lignes) {
      if (y > 540) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 })
        y = 50
      }
      const colorBand = l.sens === 'Entrée' ? '#dcfce7' : '#fee2e2'
      doc.rect(85, y - 2, 55, 12).fillColor(colorBand).fill()
      doc.fillColor('#1e293b')
      doc.text(l.date.toLocaleDateString('fr-FR'), cols.date, y, { width: 55 })
      doc.text(l.sens, cols.sens, y, { width: 50 })
      doc.text(l.espece, cols.espece, y, { width: 65 })
      doc.text(l.ident, cols.ident, y, { width: 140 })
      doc.text(l.lot, cols.lot, y, { width: 95 })
      doc.text(l.origine, cols.origine, y, { width: 115 })
      doc.text(l.destination, cols.destination, y, { width: 115 })
      doc.text(l.motif, cols.motif, y, { width: 110 })
      y += 14
    }
    if (lignes.length === 0) {
      doc.text("Aucun mouvement d'entrée/sortie pour cet exercice.", 30, y)
    }

    doc.end()
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="registre-elevage-${year}.pdf"`,
    },
  })
}
