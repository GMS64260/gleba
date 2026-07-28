/**
 * Documents de cession (Phase 1 — filière compagnie) générés depuis une
 * réservation : contrat de réservation, certificat d'engagement et de
 * connaissance (loi 30/11/2021, délai de réflexion 7 j), attestation de cession.
 *
 * GET /api/elevage/reservations/[id]/document?type=contrat|engagement|attestation
 *
 * Gleba PRÉPARE ces documents à partir des données saisies ; l'éleveur reste
 * responsable de leur conformité et des mentions officielles (I-CAD, LOF…).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import PDFDocument from 'pdfkit'
import { identifiantLegalAffichage } from '@/lib/territoires'
import { libellePetit } from '@/lib/elevage/espece-base'

type RouteParams = { params: Promise<{ id: string }> }
const TYPES = ['contrat', 'engagement', 'attestation'] as const
type DocType = (typeof TYPES)[number]

const fr = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString('fr-FR') : '……………')
const euro = (n: number | null | undefined) =>
  n != null ? `${n.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} €` : '……………'

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  const { id } = await params
  const type = (new URL(request.url).searchParams.get('type') || 'contrat') as DocType
  if (!TYPES.includes(type)) return NextResponse.json({ error: 'Type de document invalide' }, { status: 400 })

  const resa = await prisma.reservationElevage.findFirst({ where: { id, userId } })
  if (!resa) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })

  const [exploitation, naissance] = await Promise.all([
    prisma.exploitation.findUnique({ where: { userId } }),
    resa.naissanceId != null
      ? prisma.naissanceAnimale.findFirst({
          where: { id: resa.naissanceId, userId },
          include: {
            mere: { select: { nom: true, identifiant: true, race: true, especeAnimale: { select: { id: true, nom: true } } } },
            petits: { orderBy: { numero: 'asc' } },
          },
        })
      : Promise.resolve(null),
  ])

  const petit = resa.petitNaissanceId ? naissance?.petits.find((p) => p.id === resa.petitNaissanceId) ?? null : null
  const especeId = naissance?.mere?.especeAnimale?.id ?? ''
  const mots = libellePetit(especeId)
  const espLabel = naissance?.mere?.especeAnimale?.nom ?? mots.s
  const especeNormalisee = espLabel.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const chienOuChat = especeNormalisee.includes('chien') || especeNormalisee.includes('chat')
  const titre =
    type === 'contrat' ? 'Projet de contrat de réservation'
    : type === 'engagement' ? "Trame préparatoire au certificat d'engagement"
    : "Projet d'attestation de cession"

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    bufferPages: true,
    info: { Title: titre },
  })
  const chunks: Buffer[] = []
  const buffer: Buffer = await new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const M = 50
    const W = doc.page.width - M * 2
    const pageH = doc.page.height
    const limiteContenu = pageH - 76
    const ajouterSuite = () => {
      doc.addPage()
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#475569')
        .text(`${titre} · suite`, M, M)
      doc.y = M + 24
    }
    const reserver = (hauteur: number) => {
      if (doc.y + hauteur > limiteContenu) ajouterSuite()
    }
    const h = (t: string) => {
      doc.font('Helvetica-Bold').fontSize(14)
      const hauteur = doc.heightOfString(t, { width: W }) + 12
      reserver(hauteur)
      doc.fillColor('#0f172a').text(t, M, doc.y, { width: W }).moveDown(0.4)
    }
    const p = (t: string) => {
      doc.font('Helvetica').fontSize(10)
      const hauteur = doc.heightOfString(t, { width: W }) + 8
      reserver(Math.min(hauteur, limiteContenu - M))
      doc.fillColor('#1e293b').text(t, M, doc.y, { width: W }).moveDown(0.3)
    }
    const small = (t: string) => {
      doc.font('Helvetica').fontSize(8.5)
      const hauteur = doc.heightOfString(t, { width: W }) + 7
      reserver(Math.min(hauteur, limiteContenu - M))
      doc.fillColor('#64748b').text(t, M, doc.y, { width: W }).moveDown(0.2)
    }
    const sep = () => {
      reserver(18)
      doc.moveDown(0.3)
      doc.strokeColor('#e2e8f0').moveTo(M, doc.y).lineTo(M + W, doc.y).stroke()
      doc.moveDown(0.5)
    }

    // ── En-tête éleveur ─────────────────────────────────────────────
    const identExpl = exploitation ? identifiantLegalAffichage(exploitation) : null
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
      .text(exploitation?.raisonSociale || "Élevage", M, M)
    doc.font('Helvetica').fontSize(9).fillColor('#475569')
    if (exploitation) {
      if (identExpl) doc.text(`${identExpl.label} ${identExpl.valeur}`)
      doc.text(`${exploitation.adresseSiege || ''}${exploitation.codePostal ? `, ${exploitation.codePostal} ${exploitation.ville ?? ''}` : ''}`)
      if (exploitation.emailContact || exploitation.telContact) doc.text([exploitation.telContact, exploitation.emailContact].filter(Boolean).join(' · '))
    }
    doc.moveDown(1)

    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text(titre, { align: 'center' }).moveDown(1)
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#9a3412').text(
      type === 'engagement'
        ? "DOCUMENT PRÉPARATOIRE — ne vaut pas certificat délivré par une personne habilitée au sens de l’article D. 214-32-4 du code rural."
        : 'DOCUMENT PRÉPARATOIRE — compléter et vérifier toutes les mentions avant signature ou remise.',
      { width: W, align: 'center' },
    )
    doc.moveDown(0.8)

    // ── Parties ─────────────────────────────────────────────────────
    const cedantLignes = [
      exploitation?.raisonSociale,
      identExpl ? `${identExpl.label} ${identExpl.valeur}` : null,
      exploitation ? `${exploitation.adresseSiege ?? ''} ${exploitation.codePostal ?? ''} ${exploitation.ville ?? ''}`.trim() : null,
    ].filter(Boolean).join(' — ') || '……………'
    const acquereurLignes = [resa.acquereurNom, resa.acquereurTel, resa.acquereurEmail].filter(Boolean).join(' — ')

    h('Les parties')
    p(`L'éleveur (cédant) : ${cedantLignes}`)
    p(`L'acquéreur : ${acquereurLignes}`)
    sep()

    // ── Description de l'animal ─────────────────────────────────────
    h(`L'animal`)
    const desc: string[] = []
    desc.push(`Espèce / type : ${espLabel}`)
    if (naissance) {
      desc.push(`Portée : née le ${fr(naissance.date)}${naissance.mere?.nom ? `, mère « ${naissance.mere.nom} »` : ''}${naissance.pereIdentifiant ? `, père ${naissance.pereIdentifiant}` : ''}`)
      if (naissance.mere?.race) desc.push(`Race : ${naissance.mere.race}`)
    }
    if (petit) {
      desc.push(`${mots.s.charAt(0).toUpperCase() + mots.s.slice(1)} : ${petit.sexe === 'male' ? 'mâle' : petit.sexe === 'femelle' ? 'femelle' : 'sexe à préciser'}${petit.couleur ? `, robe ${petit.couleur}` : ''}`)
      const puce = petit.boucleDefinitive || petit.boucleProvisoire
      if (puce) desc.push(`Identification (puce / n°) : ${puce}`)
    }
    desc.forEach(p)
    sep()

    // ── Corps par type ──────────────────────────────────────────────
    if (type === 'contrat') {
      h('Conditions de la réservation')
      p(`Prix de cession convenu : ${euro(resa.montant)}.`)
      p(`Acompte versé à la réservation : ${euro(resa.acompte)}${resa.acompte != null && resa.montant != null ? `, soit un solde de ${euro(resa.montant - resa.acompte)} à la remise.` : '.'}`)
      p(`Date de réservation : ${fr(resa.dateReservation)}. Date de remise prévue : ${fr(resa.dateLivraison)}.`)
      p(`L'animal ne pourra être remis qu'après son identification, lorsqu'elle est obligatoire, et la remise des documents applicables à son espèce et au type de cession.`)
      p(`Pour les espèces visées par l'article L. 214-8 du code rural, la cession ne peut intervenir moins de sept jours après la délivrance du certificat d'engagement et de connaissance au cessionnaire.`)
      if (resa.notes) { doc.moveDown(0.2); small(`Observations : ${resa.notes}`) }
    } else if (type === 'engagement') {
      h("Éléments à reprendre dans le certificat délivré")
      small(`Cette trame doit être adaptée à l'espèce et délivrée par une personne remplissant les conditions réglementaires. Elle ne remplace pas le certificat définitif.`)
      p(`Je soussigné(e) ${resa.acquereurNom}, futur détenteur de l'animal ci-dessus, atteste avoir pris connaissance des besoins spécifiques de l'espèce et des obligations liées à sa détention, notamment :`)
      p(`• les besoins physiologiques, comportementaux et d'entretien (alimentation adaptée, espace, exercice, hygiène, socialisation) ;`)
      p(`• les obligations d'identification et d'enregistrement applicables à l'espèce, ainsi que le suivi vétérinaire nécessaire ;`)
      p(`• le coût d'entretien de l'animal sur toute sa durée de vie (alimentation, soins vétérinaires courants et imprévus, assurance éventuelle).`)
      doc.moveDown(0.3)
      p(`Le certificat définitif doit comporter la signature du nouvel acquéreur et sa mention manuscrite par laquelle il s'engage expressément à respecter les besoins de l'animal.`)
      p(`La cession ne peut intervenir moins de sept jours après la délivrance du certificat au cessionnaire.`)
      doc.moveDown(0.3)
      p(`Identité et qualité de la personne habilitée délivrant le certificat : …………………………………………………………………`)
      p(`Date de délivrance du certificat définitif : ………………………  →  remise possible à partir du : ………………………`)
      p(`Mention manuscrite et signature de l'acquéreur : …………………………………………………………………………………………`)
    } else {
      h('Cession')
      p(`Le cédant déclare céder à l'acquéreur l'animal désigné ci-dessus, au prix de ${euro(resa.montant)}, à la date du ${fr(resa.dateLivraison)}.`)
      h('Mentions et garanties')
      small(
        chienOuChat
          ? `• Vérifier l'identification de l'animal et effectuer les formalités de changement de détenteur dans le fichier national I-CAD.`
          : `• Vérifier l'identification et les formalités de changement de détenteur applicables à l'espèce.`,
      )
      small(
        chienOuChat
          ? `• Documents à vérifier lors de la remise : attestation de cession ou facture selon le cas, certificat vétérinaire valide, certificat d'engagement signé lorsqu'il est requis, carnet de santé ou passeport et justificatifs généalogiques éventuels.`
          : `• Documents à vérifier lors de la remise : attestation ou facture selon le cas, certificat d'engagement signé lorsqu'il est requis, documents sanitaires, d'identification et généalogiques applicables.`,
      )
      small(`• Compléter les garanties, voies de recours, conditions contractuelles et coordonnées du médiateur applicables à la situation du cédant et de l'acquéreur.`)
      small(`• Si l'animal est inscrit ou inscriptible à un livre généalogique, reporter les références exactes et joindre les justificatifs.`)
      doc.moveDown(0.3)
      p(`N° de portée / d'inscription : ……………………………………………………`)
    }

    // ── Signatures ──────────────────────────────────────────────────
    reserver(92)
    doc.moveDown(1.5)
    const y = doc.y
    doc.font('Helvetica').fontSize(9).fillColor('#475569')
    doc.text("L'éleveur (cédant)", M, y)
    doc.text("L'acquéreur", M + W / 2, y)
    doc.fontSize(8).fillColor('#94a3b8')
    doc.text('Fait à ……………………, le ……………………', M, y + 14)
    doc.text('« Lu et approuvé »', M + W / 2, y + 14)

    doc.moveDown(4)
    small(`À compléter avant utilisation : adresse de l'acquéreur, identité et adresse exactes du cédant, identification définitive de l'animal, pièces justificatives et mentions propres au contrat et à l'espèce.`)

    const pages = doc.bufferedPageRange()
    for (let index = pages.start; index < pages.start + pages.count; index += 1) {
      doc.switchToPage(index)
      doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
        .text(
          `Préparé via Gleba le ${fr(new Date())} · page ${index + 1}/${pages.count} · document à vérifier et compléter`,
          M,
          pageH - 62,
          { width: W, align: 'center', lineBreak: false },
        )
    }

    doc.end()
  })

  const noms: Record<DocType, string> = { contrat: 'contrat-reservation', engagement: 'certificat-engagement', attestation: 'attestation-cession' }
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${noms[type]}-${resa.acquereurNom.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf"`,
    },
  })
}
