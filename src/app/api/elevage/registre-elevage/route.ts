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
import { z } from 'zod'
import { identifiantLegalAffichage } from '@/lib/territoires'
import {
  acteurReglementaire,
  journaliserEvenementReglementaire,
} from '@/lib/elevage/audit-reglementaire'
import { empreinteDeclaration } from '@/lib/elevage/declarations-reglementaires'
import {
  dessinerEnteteTableauPdf,
  dessinerLigneTableauPdf,
  hauteurLignePdf,
  lignePdfEstTronquee,
  type ColonnePdf,
} from '@/lib/pdf-table'

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

const texteNormalise = (value: string | null | undefined) =>
  (value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

const memeJourUTC = (a: Date | null, b: Date | null) =>
  Boolean(
    a
      && b
      && a.getUTCFullYear() === b.getUTCFullYear()
      && a.getUTCMonth() === b.getUTCMonth()
      && a.getUTCDate() === b.getUTCDate(),
  )

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const parsedYear = z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1)
    .safeParse(searchParams.get('year') || String(new Date().getFullYear()))
  if (!parsedYear.success) {
    return NextResponse.json({ error: "Année invalide" }, { status: 400 })
  }
  const year = parsedYear.data
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31, 23, 59, 59)
  const userId = session.user.id

  const [entrees, sorties, lotsArrives, lotsTermine, abattagesLots, naissances, exploitation] = await Promise.all([
    prisma.animal.findMany({
      where: { userId, dateArrivee: { gte: start, lte: end } },
      include: {
        especeAnimale: { select: { nom: true } },
        lot: { select: { id: true, nom: true } },
        ficheNaissance: { select: { id: true } },
      },
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
    const naissanceSurExploitation =
      Boolean(a.ficheNaissance)
      || (
        memeJourUTC(a.dateArrivee, a.dateNaissance)
        && texteNormalise(a.provenance).includes("naissance")
      )
    if (naissanceSurExploitation) continue
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

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 30,
    bufferPages: true,
  })
  const chunks: Buffer[] = []
  let nombreLignesTronquees = 0
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
      doc.text(
        `${exploitation.raisonSociale}${identExpl ? ` — ${identExpl.label} ${identExpl.valeur}` : ""}`,
        30,
        64,
        { width: 360, height: 12, ellipsis: true, lineBreak: true },
      )
      doc.text(
        `${exploitation.adresseSiege}, ${exploitation.codePostal} ${exploitation.ville}`,
        30,
        78,
        { width: 360, height: 12, ellipsis: true, lineBreak: true },
      )
      if (exploitation.numeroEde) {
        doc.text(
          `N° exploitation / EDE : ${exploitation.numeroEde}`,
          410,
          64,
          { width: 400, height: 12, ellipsis: true, lineBreak: true },
        )
      }
      if (exploitation.lieuDetentionPrincipal) {
        doc.text(
          `Détention : ${exploitation.lieuDetentionPrincipal}`,
          410,
          78,
          { width: 400, height: 12, ellipsis: true, lineBreak: true },
        )
      }
    }
    doc.text(`Imprimé le ${new Date().toLocaleDateString('fr-FR')}`, 30, 88)
    doc.fontSize(8).fillColor('#94a3b8').text(
      "Référence : arrêté du 5 juin 2000, art. 11 — conservation minimale de 5 ans, sous réserve des exceptions applicables",
      30,
      100,
    )

    const colonnes: ColonnePdf<Ligne>[] = [
      { titre: 'Date', x: 30, largeur: 58, valeur: (ligne) => ligne.date.toLocaleDateString('fr-FR') },
      { titre: 'Sens', x: 90, largeur: 52, valeur: (ligne) => ligne.sens },
      { titre: 'Espèce', x: 145, largeur: 67, valeur: (ligne) => ligne.espece },
      { titre: 'Identifiant', x: 215, largeur: 142, valeur: (ligne) => ligne.ident },
      { titre: 'Lot', x: 360, largeur: 97, valeur: (ligne) => ligne.lot },
      { titre: 'Origine', x: 460, largeur: 117, valeur: (ligne) => ligne.origine },
      { titre: 'Destination', x: 580, largeur: 117, valeur: (ligne) => ligne.destination },
      { titre: 'Motif', x: 700, largeur: 110, valeur: (ligne) => ligne.motif },
    ]
    let y = dessinerEnteteTableauPdf(doc, colonnes, 120)
    const lignesTronquees: Ligne[] = []
    for (const l of lignes) {
      const hauteur = hauteurLignePdf(doc, l, colonnes, {
        taillePolice: 7,
        hauteurMax: 38,
      })
      if (y + hauteur > 535) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 })
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
          .text(`Registre d’élevage ${year} · suite`)
        y = dessinerEnteteTableauPdf(doc, colonnes, 58)
      }
      if (lignePdfEstTronquee(doc, l, colonnes, {
        taillePolice: 7,
        hauteurMax: 38,
      })) {
        lignesTronquees.push(l)
      }
      y = dessinerLigneTableauPdf(doc, l, colonnes, y, {
        taillePolice: 7,
        hauteurMax: 38,
        fond: l.sens === 'Entrée' ? '#f0fdf4' : '#fff1f2',
      })
    }
    if (lignes.length === 0) {
      doc.text("Aucun mouvement d'entrée/sortie pour cet exercice.", 30, y)
    }
    if (lignesTronquees.length) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 })
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a')
        .text('Annexe · valeurs intégrales des cellules abrégées')
      doc.font('Helvetica').fontSize(8).fillColor('#475569')
        .text('Les lignes concernées sont reproduites sans colonnes afin de conserver toutes les informations.')
      y = doc.y + 12
      for (const ligneTronquee of lignesTronquees) {
        const contenu = `${ligneTronquee.date.toLocaleDateString('fr-FR')} · ${ligneTronquee.sens} · ${ligneTronquee.espece} · ${ligneTronquee.ident} · lot ${ligneTronquee.lot || '—'} · origine ${ligneTronquee.origine || '—'} · destination ${ligneTronquee.destination || '—'} · motif ${ligneTronquee.motif || '—'}`
        doc.font('Helvetica').fontSize(8)
        const hauteur = doc.heightOfString(contenu, { width: 760 }) + 7
        if (y + hauteur > 535) {
          doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 })
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
            .text(`Annexe du registre des mouvements ${year} · suite`)
          y = 58
        }
        doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
          .text(contenu, 30, y, { width: 760 })
        y += hauteur
      }
    }
    nombreLignesTronquees = lignesTronquees.length

    const pages = doc.bufferedPageRange()
    for (let index = pages.start; index < pages.start + pages.count; index += 1) {
      doc.switchToPage(index)
      doc.font('Helvetica').fontSize(7).fillColor('#94a3b8').text(
        `Gleba · registre des mouvements ${year} · page ${index + 1}/${pages.count}`,
        30,
        550,
        { width: 780, align: 'center', lineBreak: false },
      )
    }
    doc.end()
  })
  const snapshotHash = empreinteDeclaration({
    version: 1,
    year,
    exploitation: exploitation
      ? { raisonSociale: exploitation.raisonSociale, numeroEde: exploitation.numeroEde }
      : null,
    lignes,
  })
  await journaliserEvenementReglementaire(prisma, {
    userId,
    declarationKey: `registre-mouvements:${year}`,
    action: "REGISTRE_MOUVEMENTS_GENERE",
    actorUserId: acteurReglementaire(session.user),
    snapshotHash,
    metadata: {
      year,
      mouvements: lignes.length,
      lignesAvecAnnexe: nombreLignesTronquees,
    },
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="registre-elevage-${year}.pdf"`,
    },
  })
}
