/**
 * Registre sanitaire (PROMPT 19B §10).
 *
 * Liste chronologique des soins et traitements sur l'exercice.
 * Conservation minimale de cinq ans (arrêté du 5 juin 2000, art. 11),
 * sous réserve des durées particulières prévues par le même article.
 *
 * GET /api/elevage/registre-sanitaire?year=2026
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

type LigneSoin = {
  date: string
  type: string
  cible: string
  produit: string
  dose: string
  voie: string
  motif: string
  attenteLait: string
  attenteViande: string
  administrations: string
  ordonnance: string
  veterinaire: string
}

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
  const userId = session.user.id
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31, 23, 59, 59)

  const [
    soins,
    exploitation,
    prophylaxies,
    animauxSanitaires,
    statutsSanitairesStructures,
    pharmacie,
  ] = await Promise.all([
    prisma.soinAnimal.findMany({
      where: { userId, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
      include: {
        animal: { select: { id: true, nom: true, identifiant: true } },
        lot: { select: { id: true, nom: true } },
        produitVeterinaire: { select: { nom: true, substanceActive: true, amm: true } },
        injections: {
          orderBy: { numero: 'asc' },
          select: { numero: true, datePrevue: true, dateRealisee: true, statut: true },
        },
      },
    }),
    prisma.exploitation.findUnique({ where: { userId } }),
    prisma.prophylaxieElevage.findMany({
      where: { userId, datePrevue: { gte: start, lte: end } },
      orderBy: { datePrevue: 'asc' },
    }),
    // Le statut sanitaire existait dans le modèle Animal mais n'était jamais
    // restitué dans le registre (ticket cms1v8am6).
    prisma.animal.findMany({
      where: { userId, statutSanitaire: { isEmpty: false } },
      orderBy: [{ statut: 'asc' }, { nom: 'asc' }],
      select: {
        id: true,
        identifiant: true,
        nom: true,
        statut: true,
        statutSanitaire: true,
      },
    }),
    prisma.statutSanitaireElevage.findMany({
      where: { userId },
      orderBy: [{ maladie: { nom: 'asc' } }, { dateControle: 'desc' }],
      include: {
        maladie: { select: { nom: true } },
        animal: { select: { id: true, nom: true, identifiant: true } },
        lot: { select: { id: true, nom: true } },
      },
    }),
    prisma.stockMedicamentElevage.findMany({
      where: { userId },
      orderBy: { datePeremption: 'asc' },
      include: { produit: { select: { nom: true, amm: true } } },
    }),
  ])

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
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text('Registre sanitaire — soins et traitements', 30, 30)
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
      if (exploitation.veterinaireSanitaire) {
        doc.text(
          `Vétérinaire sanitaire : ${exploitation.veterinaireSanitaire}`,
          410,
          78,
          { width: 400, height: 12, ellipsis: true, lineBreak: true },
        )
      }
    }
    doc.fontSize(8).fillColor('#94a3b8').text(
      'Référence : arrêté du 5 juin 2000, art. 11 — conservation minimale de 5 ans, sous réserve des exceptions applicables',
      30,
      96,
    )

    const lignesSoins: LigneSoin[] = soins.map((soin) => {
      const cible = soin.animal
        ? `${soin.animal.identifiant || `#${soin.animal.id}`}${soin.animal.nom ? ` (${soin.animal.nom})` : ''}`
        : soin.lot
        ? `Lot ${soin.lot.nom || `#${soin.lot.id}`}`
        : '—'
      const sourceDelai = soin.delaiAttenteSource === 'cascade'
        ? ' · délai cascade'
        : soin.delaiAttenteSource === 'prescription'
          ? ' · délai prescrit'
          : soin.delaiAttenteSource === 'referentiel_espece'
            ? ' · délai espèce'
            : ''
      const produit = soin.produitVeterinaire
        ? `${soin.produitVeterinaire.nom}${soin.produitVeterinaire.amm ? ` — ${soin.produitVeterinaire.amm}` : ''}`
        : soin.produit || '—'
      const lotMedicament = soin.numeroLotMedicament
        ? ` · lot ${soin.numeroLotMedicament}${soin.peremptionMedicament ? ` · pér. ${soin.peremptionMedicament.toLocaleDateString('fr-FR')}` : ''}`
        : ''
      const realisees = soin.injections.filter((injection) => injection.dateRealisee).length
      return {
        date: new Date(soin.date).toLocaleDateString('fr-FR'),
        type: soin.fait ? soin.type : `${soin.type} (prévu)`,
        cible,
        produit: `${produit}${lotMedicament}${sourceDelai}`,
        dose: soin.dose || '—',
        voie: soin.voie || '—',
        motif: soin.motif || soin.description || '—',
        attenteLait: soin.finAttenteLait ? new Date(soin.finAttenteLait).toLocaleDateString('fr-FR') : '—',
        attenteViande: soin.finAttenteViande ? new Date(soin.finAttenteViande).toLocaleDateString('fr-FR') : '—',
        administrations: `${realisees}/${soin.injections.length || 1}`,
        ordonnance: soin.ordonnanceUrl ? 'Oui' : 'Non',
        veterinaire: soin.veterinaire || '—',
      }
    })
    const colonnes: ColonnePdf<LigneSoin>[] = [
      { titre: 'Date', x: 30, largeur: 55, valeur: (ligne) => ligne.date },
      { titre: 'Type', x: 88, largeur: 65, valeur: (ligne) => ligne.type },
      { titre: 'Animal/Lot', x: 156, largeur: 95, valeur: (ligne) => ligne.cible },
      { titre: 'Produit (AMM)', x: 254, largeur: 105, valeur: (ligne) => ligne.produit },
      { titre: 'Dose', x: 362, largeur: 48, valeur: (ligne) => ligne.dose },
      { titre: 'Voie', x: 413, largeur: 40, valeur: (ligne) => ligne.voie },
      { titre: 'Motif', x: 456, largeur: 85, valeur: (ligne) => ligne.motif },
      { titre: 'Att. lait', x: 544, largeur: 53, valeur: (ligne) => ligne.attenteLait },
      { titre: 'Att. viande', x: 600, largeur: 53, valeur: (ligne) => ligne.attenteViande },
      { titre: 'Adm.', x: 656, largeur: 50, valeur: (ligne) => ligne.administrations },
      { titre: 'Vétérinaire', x: 709, largeur: 78, valeur: (ligne) => ligne.veterinaire },
      { titre: 'Ord.', x: 790, largeur: 22, valeur: (ligne) => ligne.ordonnance },
    ]
    let y = dessinerEnteteTableauPdf(doc, colonnes, 120)
    const lignesTronquees: LigneSoin[] = []
    for (const ligneSoin of lignesSoins) {
      const hauteur = hauteurLignePdf(doc, ligneSoin, colonnes, {
        taillePolice: 6.5,
        hauteurMax: 40,
      })
      if (y + hauteur > 535) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 })
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
          .text(`Registre sanitaire ${year} · soins · suite`)
        y = dessinerEnteteTableauPdf(doc, colonnes, 58)
      }
      if (lignePdfEstTronquee(doc, ligneSoin, colonnes, {
        taillePolice: 6.5,
        hauteurMax: 40,
      })) {
        lignesTronquees.push(ligneSoin)
      }
      y = dessinerLigneTableauPdf(doc, ligneSoin, colonnes, y, {
        taillePolice: 6.5,
        hauteurMax: 40,
        fond: lignesSoins.indexOf(ligneSoin) % 2 ? '#f8fafc' : undefined,
      })
    }
    if (soins.length === 0) {
      doc.text('Aucun soin enregistré pour cet exercice.', 30, y)
    }

    doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 })
    y = 35
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('Prophylaxies et contrôles', 30, y)
    y += 24
    const ligneListe = (contenu: string, titreSuite: string) => {
      doc.font('Helvetica').fontSize(8)
      const hauteur = Math.max(13, doc.heightOfString(contenu, { width: 760 }) + 4)
      if (y + hauteur > 535) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 })
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(titreSuite, 30, 35)
        y = 58
      }
      doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
        .text(contenu, 30, y, { width: 760 })
      y += hauteur
    }
    for (const p of prophylaxies) {
      ligneListe(
        `${p.datePrevue.toLocaleDateString('fr-FR')} · ${p.type} · ${p.statut} · ${p.organisme || '—'} · ${p.resultat || ''}`,
        `Prophylaxies et contrôles ${year} · suite`,
      )
    }
    if (!prophylaxies.length) { doc.text('Aucune prophylaxie enregistrée.', 30, y); y += 16 }

    y += 12
    doc.font('Helvetica-Bold').fontSize(14).text('Statuts sanitaires des animaux', 30, y)
    y += 24
    for (const item of statutsSanitairesStructures) {
      const cible = item.animal
        ? [item.animal.nom, item.animal.identifiant].filter(Boolean).join(' · ') || `Animal #${item.animal.id}`
        : `Lot ${item.lot?.nom || `#${item.lot?.id}`}`
      const controle = item.dateControle?.toLocaleDateString('fr-FR') || 'date inconnue'
      ligneListe(
        `${item.maladie.nom} · ${cible} · ${item.statut} · contrôle ${controle} · laboratoire ${item.laboratoire || '—'} · analyse ${item.numeroAnalyse || '—'}`,
        `Statuts sanitaires structurés ${year} · suite`,
      )
    }
    for (const animal of animauxSanitaires) {
      const cible = [
        animal.nom,
        animal.identifiant,
      ].filter(Boolean).join(' · ') || `Animal #${animal.id}`
      ligneListe(
        `${cible} · ${animal.statut} · ${animal.statutSanitaire.join(' ; ')}`,
        `Statuts sanitaires des animaux ${year} · suite`,
      )
    }
    if (!animauxSanitaires.length && !statutsSanitairesStructures.length) {
      doc.text('Aucun statut sanitaire animal renseigné.', 30, y)
      y += 16
    }

    y += 12
    doc.font('Helvetica-Bold').fontSize(14).text('Inventaire de la pharmacie', 30, y)
    y += 24
    for (const s of pharmacie) {
      const peremption = s.datePeremption ? s.datePeremption.toLocaleDateString('fr-FR') : 'non renseignée'
      ligneListe(
        `${s.produit?.nom || s.produitId}${s.produit?.amm ? ` · ${s.produit.amm}` : ''} · lot ${s.numeroLot} · ${s.quantite} ${s.unite} · péremption ${peremption} · ordonnance ${s.ordonnanceUrl ? 'oui' : 'non'}`,
        `Inventaire de la pharmacie ${year} · suite`,
      )
    }
    if (!pharmacie.length) doc.text('Aucun stock de médicament enregistré.', 30, y)
    if (lignesTronquees.length) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 })
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a')
        .text('Annexe · détails complets des soins abrégés')
      doc.font('Helvetica').fontSize(8).fillColor('#475569')
        .text('Le tableau conserve une hauteur de ligne lisible. Les valeurs intégrales sont reproduites ci-dessous.')
      y = doc.y + 12
      for (const ligneSoin of lignesTronquees) {
        const contenu = `${ligneSoin.date} · ${ligneSoin.type} · ${ligneSoin.cible} · ${ligneSoin.produit} · dose ${ligneSoin.dose} · voie ${ligneSoin.voie} · motif ${ligneSoin.motif} · attente lait ${ligneSoin.attenteLait} · attente viande ${ligneSoin.attenteViande} · administrations ${ligneSoin.administrations} · vétérinaire ${ligneSoin.veterinaire} · ordonnance ${ligneSoin.ordonnance}`
        doc.font('Helvetica').fontSize(8)
        const hauteur = doc.heightOfString(contenu, { width: 760 }) + 7
        if (y + hauteur > 535) {
          doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 })
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
            .text(`Annexe du registre sanitaire ${year} · suite`)
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
        `Gleba · registre sanitaire ${year} · page ${index + 1}/${pages.count}`,
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
    soins: soins.map((soin) => ({
      id: soin.id,
      createdAt: soin.createdAt,
      injections: soin.injections.map((injection) => ({
        numero: injection.numero,
        statut: injection.statut,
        dateRealisee: injection.dateRealisee,
      })),
    })),
    prophylaxies: prophylaxies.map((item) => ({ id: item.id, updatedAt: item.updatedAt })),
    animauxSanitaires: animauxSanitaires.map((item) => ({
      id: item.id,
      statut: item.statut,
      statutSanitaire: item.statutSanitaire,
    })),
    statutsSanitairesStructures: statutsSanitairesStructures.map((item) => ({
      id: item.id,
      updatedAt: item.updatedAt,
      statut: item.statut,
      dateControle: item.dateControle,
    })),
    pharmacie: pharmacie.map((item) => ({ id: item.id, updatedAt: item.updatedAt })),
  })
  await journaliserEvenementReglementaire(prisma, {
    userId,
    declarationKey: `registre-sanitaire:${year}`,
    action: "REGISTRE_SANITAIRE_GENERE",
    actorUserId: acteurReglementaire(session.user),
    snapshotHash,
    metadata: {
      year,
      soins: soins.length,
      prophylaxies: prophylaxies.length,
      animauxAvecStatutSanitaire: animauxSanitaires.length,
      qualificationsSanitairesStructurees: statutsSanitairesStructures.length,
      pharmacie: pharmacie.length,
      lignesAvecAnnexe: nombreLignesTronquees,
    },
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="registre-sanitaire-${year}.pdf"`,
    },
  })
}
