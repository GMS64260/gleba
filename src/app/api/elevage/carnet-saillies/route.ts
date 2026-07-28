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
import { z } from 'zod'
import { identifiantLegalAffichage } from '@/lib/territoires'
import {
  dessinerEnteteTableauPdf,
  dessinerLigneTableauPdf,
  hauteurLignePdf,
  lignePdfEstTronquee,
  type ColonnePdf,
} from '@/lib/pdf-table'

type LigneCarnet = {
  date: string
  type: string
  femelle: string
  male: string
  miseBasAttendue: string
  statut: string
  resultat: string
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const parsed = z.object({
    year: z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
    filiere: z.enum(['toutes', 'rente', 'compagnie', 'equin', 'nac']).nullable(),
  }).safeParse({
    year: searchParams.get('year') || String(new Date().getFullYear()),
    filiere: searchParams.get('filiere'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Année ou filière invalide' }, { status: 400 })
  }
  const { year, filiere } = parsed.data
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31, 23, 59, 59)

  // Scoping par filière de l'atelier (via l'espèce de la femelle) : un carnet
  // « Chiens & chats » ne doit pas embarquer les saillies du cheptel.
  const filiereWhere =
    filiere && filiere !== 'toutes'
      ? { femelle: { especeAnimale: { filiere } } }
      : {}

  const [saillies, exploitation] = await Promise.all([
    prisma.saillie.findMany({
      where: { userId: session.user.id, date: { gte: start, lte: end }, ...filiereWhere },
      orderBy: { date: 'asc' },
      include: {
        femelle: { select: { id: true, nom: true, identifiant: true, race: true } },
        male: { select: { id: true, nom: true, identifiant: true, race: true } },
        miseBas: { select: { id: true, date: true, nombreNes: true, nombreVivants: true } },
      },
    }),
    prisma.exploitation.findUnique({ where: { userId: session.user.id } }),
  ])

  const lignes: LigneCarnet[] = saillies.map((s) => {
    const femelle = `${s.femelle.identifiant || `#${s.femelle.id}`}${s.femelle.nom ? ` (${s.femelle.nom})` : ''}`
    const male = s.male
      ? `${s.male.identifiant || `#${s.male.id}`}${s.male.nom ? ` (${s.male.nom})` : ''}`
      : s.pereExterneRef || (s.agentInseminateur ? `IA ${s.agentInseminateur}` : '—')
    return {
      date: new Date(s.date).toLocaleDateString('fr-FR'),
      type: s.type,
      femelle,
      male,
      miseBasAttendue: new Date(s.dateMiseBasAttendue).toLocaleDateString('fr-FR'),
      statut: s.statut,
      resultat: s.miseBas
        ? `${s.miseBas.nombreVivants}/${s.miseBas.nombreNes} le ${new Date(s.miseBas.date).toLocaleDateString('fr-FR')}`
        : '—',
    }
  })

  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    bufferPages: true,
    info: { Title: `Carnet de saillies ${year}` },
  })
  const chunks: Buffer[] = []
  const buffer: Buffer = await new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // En-tête
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text('Carnet de saillies', 40, 40)
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text(`Exercice ${year}`, 40, 62)
    if (exploitation) {
      const identExpl = identifiantLegalAffichage(exploitation)
      doc.text(
        `${exploitation.raisonSociale}${identExpl ? ` — ${identExpl.label} ${identExpl.valeur}` : ""}`,
        40,
        76,
        { width: 515 },
      )
      doc.text(
        `${exploitation.adresseSiege}, ${exploitation.codePostal} ${exploitation.ville}`,
        { width: 515 },
      )
    }
    doc.text(`Imprimé le ${new Date().toLocaleDateString('fr-FR')}`, { width: 515 })
    doc.moveDown(0.4)
    doc.fontSize(8).fillColor('#9a3412').text(
      'Document préparé depuis les données saisies dans Gleba : vérifier les identités, dates et résultats avant présentation ou archivage.',
      { width: 515 },
    )

    const colonnes: ColonnePdf<LigneCarnet>[] = [
      { titre: 'Date', x: 40, largeur: 58, valeur: (ligne) => ligne.date },
      { titre: 'Type', x: 101, largeur: 60, valeur: (ligne) => ligne.type },
      { titre: 'Femelle', x: 164, largeur: 96, valeur: (ligne) => ligne.femelle },
      { titre: 'Mâle / IA', x: 263, largeur: 103, valeur: (ligne) => ligne.male },
      { titre: 'Mise-bas att.', x: 369, largeur: 64, valeur: (ligne) => ligne.miseBasAttendue },
      { titre: 'Statut', x: 436, largeur: 58, valeur: (ligne) => ligne.statut },
      { titre: 'Résultat', x: 497, largeur: 58, valeur: (ligne) => ligne.resultat },
    ]
    let y = dessinerEnteteTableauPdf(doc, colonnes, Math.max(doc.y + 12, 145))
    const lignesTronquees: LigneCarnet[] = []
    for (const ligne of lignes) {
      const hauteur = hauteurLignePdf(doc, ligne, colonnes, {
        taillePolice: 6.5,
        hauteurMax: 40,
      })
      if (y + hauteur > 790) {
        doc.addPage()
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
          .text(`Carnet de saillies ${year} · suite`, 40, 40)
        y = dessinerEnteteTableauPdf(doc, colonnes, 62)
      }
      if (lignePdfEstTronquee(doc, ligne, colonnes, {
        taillePolice: 6.5,
        hauteurMax: 40,
      })) {
        lignesTronquees.push(ligne)
      }
      y = dessinerLigneTableauPdf(doc, ligne, colonnes, y, {
        taillePolice: 6.5,
        hauteurMax: 40,
        fond: lignes.indexOf(ligne) % 2 ? '#f8fafc' : undefined,
      })
    }

    if (lignes.length === 0) {
      doc.font('Helvetica').fontSize(8).fillColor('#475569')
        .text('Aucune saillie enregistrée pour cet exercice.', 40, y)
    }

    if (lignesTronquees.length) {
      doc.addPage()
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a')
        .text('Annexe · détails complets des lignes abrégées', 40, 40)
      doc.font('Helvetica').fontSize(8).fillColor('#475569')
        .text('Les valeurs intégrales sont reproduites ci-dessous.', { width: 515 })
      y = doc.y + 12
      for (const ligne of lignesTronquees) {
        const contenu = `${ligne.date} · ${ligne.type} · femelle ${ligne.femelle} · mâle / IA ${ligne.male} · mise-bas attendue ${ligne.miseBasAttendue} · statut ${ligne.statut} · résultat ${ligne.resultat}`
        doc.font('Helvetica').fontSize(8)
        const hauteur = doc.heightOfString(contenu, { width: 515 }) + 8
        if (y + hauteur > 790) {
          doc.addPage()
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
            .text(`Annexe du carnet de saillies ${year} · suite`, 40, 40)
          y = 64
        }
        doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
          .text(contenu, 40, y, { width: 515 })
        y += hauteur
      }
    }

    const pages = doc.bufferedPageRange()
    for (let index = pages.start; index < pages.start + pages.count; index += 1) {
      doc.switchToPage(index)
      doc.font('Helvetica').fontSize(7).fillColor('#94a3b8').text(
        `Gleba · carnet de saillies ${year} · page ${index + 1}/${pages.count}`,
        40,
        792,
        { width: 515, align: 'center', lineBreak: false },
      )
    }

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
