/**
 * Export PDF du pedigree d'un animal (Phase 1 — filières compagnie/équin).
 * Arbre sur 3 générations + entête LOF/cotation. GET /api/elevage/animaux/[id]/pedigree
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import PDFDocument from 'pdfkit'
import { genealogie, type GenealogyNode } from '@/lib/reproduction'
import { identifiantLegalAffichage } from '@/lib/territoires'

type RouteParams = { params: Promise<{ id: string }> }

const COTATIONS: Record<number, string> = {
  1: 'Confirmé', 2: 'Reconnu', 3: 'Sélectionné', 4: 'Recommandé', 5: 'Élite B', 6: 'Élite A',
}

/** Ancêtre à la génération g (1..3), index i (0 = tout paternel en haut). */
function ancestorAt(tree: GenealogyNode | null, g: number, i: number): GenealogyNode | null {
  let node = tree
  for (let b = g - 1; b >= 0; b--) {
    if (!node) return null
    node = ((i >> b) & 1) === 0 ? node.pere : node.mere
  }
  return node
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id
  const id = Number((await params).id)

  const animal = await prisma.animal.findFirst({
    where: { id, userId },
    select: { id: true, nom: true, identifiant: true, race: true, sexe: true, dateNaissance: true, especeAnimale: { select: { nom: true, filiere: true } } },
  })
  if (!animal) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })

  const [pedigree, exploitation, tree] = await Promise.all([
    prisma.pedigreeElevage.findFirst({ where: { userId, animalId: id } }),
    prisma.exploitation.findUnique({ where: { userId } }),
    genealogie(prisma, id, 3, userId),
  ])

  const fr = (d: Date | null | undefined) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')
  const sexeLabel = (s: string | null | undefined) =>
    s === 'femelle' ? 'F' : s === 'male' ? 'M' : '—'
  const identiteNode = (n: GenealogyNode | null) => {
    if (!n) return '—'
    return [
      n.nom || null,
      n.identifiant || (!n.nom ? `#${n.id}` : null),
      `sexe ${sexeLabel(n.sexe)}`,
    ].filter(Boolean).join(' · ')
  }

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 40,
    bufferPages: true,
    info: { Title: `Pedigree de ${animal.nom || animal.identifiant || animal.id}` },
  })
  const chunks: Buffer[] = []
  const buffer: Buffer = await new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const M = 40
    const pageW = doc.page.width
    const pageH = doc.page.height

    // En-tête
    const identExpl = exploitation ? identifiantLegalAffichage(exploitation) : null
    const detailsAnnexe = new Set<string>()
    const exploitationLabel = exploitation?.raisonSociale || 'Élevage'
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569')
    if (doc.widthOfString(exploitationLabel) > 225) {
      detailsAnnexe.add(`Exploitation : ${exploitationLabel}`)
    }
    doc.text(exploitationLabel, M, M, {
      width: 225,
      height: 12,
      ellipsis: true,
      lineBreak: true,
    })
    if (identExpl) {
      doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(
        `${identExpl.label} ${identExpl.valeur}`,
        M,
        M + 13,
        { width: 225, height: 10, ellipsis: true, lineBreak: true },
      )
    }
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text('Pedigree', M, M, { width: pageW - M * 2, align: 'center' })

    // Sujet + registre/cotation, adaptés à la filière (SIRE/UELN pour un cheval,
    // registre pour un NAC, pas de cotation SCC hors compagnie).
    const filiere = animal.especeAnimale?.filiere ?? 'compagnie'
    const registrePrefix = filiere === 'equin' ? 'SIRE/UELN' : filiere === 'nac' ? 'Registre' : 'LOF/LOOF'
    const confirmLabel = filiere === 'equin' ? 'Inscrit au stud-book' : filiere === 'nac' ? 'Inscrit au registre' : 'Confirmé'
    const showCot = filiere !== 'equin' && filiere !== 'nac'
    const cot = pedigree?.cotation
    const ligne2 = [
      animal.especeAnimale?.nom || null,
      animal.race || null,
      animal.dateNaissance ? `né(e) le ${fr(animal.dateNaissance)}` : null,
      pedigree?.numeroLof ? `${registrePrefix} ${pedigree.numeroLof}` : null,
      showCot && cot ? `Cotation ${cot} — ${COTATIONS[cot] ?? ''}` : null,
      pedigree?.confirmationLof ? `${confirmLabel}${pedigree.dateConfirmation ? ` le ${fr(pedigree.dateConfirmation)}` : ''}` : null,
    ].filter(Boolean).join('  ·  ')
    const sujet = [
      animal.nom || null,
      animal.identifiant || (!animal.nom ? `#${animal.id}` : null),
      `sexe ${sexeLabel(animal.sexe)}`,
    ].filter(Boolean).join(' · ')
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a')
    if (doc.heightOfString(sujet, { width: pageW - M * 2 }) > 16) {
      detailsAnnexe.add(`Sujet : ${sujet}`)
    }
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a')
      .text(sujet, M, M + 28, {
        width: pageW - M * 2,
        height: 16,
        ellipsis: true,
        lineBreak: true,
      })
    doc.font('Helvetica').fontSize(8.5)
    if (doc.heightOfString(ligne2, { width: pageW - M * 2 }) > 22) {
      detailsAnnexe.add(`Sujet : ${sujet} · ${ligne2}`)
    }
    doc.fillColor('#475569').text(ligne2, M, M + 46, {
      width: pageW - M * 2,
      height: 22,
      ellipsis: true,
      lineBreak: true,
    })
    if (pedigree?.titres) {
      const titres = `Titres : ${pedigree.titres}`
      doc.font('Helvetica-Oblique').fontSize(8)
      if (doc.heightOfString(titres, { width: pageW - M * 2 }) > 12) {
        detailsAnnexe.add(titres)
      }
      doc.fillColor('#64748b').text(titres, M, M + 70, {
        width: pageW - M * 2,
        height: 12,
        ellipsis: true,
        lineBreak: true,
      })
    }

    // Grille pedigree — 3 générations (colonnes 1..3 ; le sujet est l'entête)
    const top = M + 92
    const H = pageH - top - 72
    const colW = (pageW - M * 2) / 3
    const gens = 3
    for (let g = 1; g <= gens; g++) {
      const n = 2 ** g
      const ch = H / n
      const x = M + (g - 1) * colW
        const fs = ch > 90 ? 10 : ch > 45 ? 8 : 6.5
      for (let i = 0; i < n; i++) {
        const node = ancestorAt(tree, g, i)
        const y = top + i * ch
        const identite = identiteNode(node)
        const hauteurNom = Math.min(22, Math.max(10, ch - 22))
        doc.font('Helvetica-Bold').fontSize(fs)
        if (
          node
          && doc.heightOfString(identite, { width: colW - 16 }) > hauteurNom
        ) {
          detailsAnnexe.add(
            `Génération ${g}, branche ${i + 1} : ${identite} · race ${node.race || 'non renseignée'} · naissance ${fr(node.dateNaissance) || 'non renseignée'}`,
          )
        }
        doc.roundedRect(x + 3, y + 2, colW - 8, ch - 4, 3).strokeColor('#cbd5e1').lineWidth(0.5).stroke()
        doc.font('Helvetica-Bold').fontSize(fs).fillColor(node ? '#0f172a' : '#94a3b8')
          .text(identite, x + 8, y + 6, {
            width: colW - 16,
            height: hauteurNom,
            ellipsis: true,
            lineBreak: true,
          })
        if (node?.race) {
          const tailleRace = Math.max(6, fs - 1.5)
          doc.font('Helvetica').fontSize(tailleRace)
          if (doc.heightOfString(node.race, { width: colW - 16 }) > 11) {
            detailsAnnexe.add(
              `Génération ${g}, branche ${i + 1} : ${identite} · race ${node.race}`,
            )
          }
          doc.fillColor('#64748b').text(node.race, x + 8, y + ch - 17, {
            width: colW - 16,
            height: 11,
            ellipsis: true,
            lineBreak: true,
          })
        }
      }
    }

    // Colonnes : légende des générations en pied
    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
    ;['Parents', 'Grands-parents', 'Arrière-grands-parents'].forEach((lbl, g) => {
      doc.text(lbl, M + g * colW + 3, pageH - 67, { width: colW - 8 })
    })

    if (detailsAnnexe.size) {
      doc.addPage()
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a')
        .text('Annexe · libellés complets du pedigree', M, M)
      doc.font('Helvetica').fontSize(8).fillColor('#475569')
        .text('Les valeurs abrégées dans la grille sont reproduites intégralement ci-dessous.')
      let y = doc.y + 12
      for (const detail of detailsAnnexe) {
        doc.font('Helvetica').fontSize(8)
        const hauteur = doc.heightOfString(detail, { width: pageW - M * 2 }) + 8
        if (y + hauteur > pageH - 58) {
          doc.addPage()
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
            .text('Annexe du pedigree · suite', M, M)
          y = M + 24
        }
        doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
          .text(detail, M, y, { width: pageW - M * 2 })
        y += hauteur
      }
    }

    const pages = doc.bufferedPageRange()
    for (let index = pages.start; index < pages.start + pages.count; index += 1) {
      doc.switchToPage(index)
      doc.font('Helvetica').fontSize(7).fillColor('#94a3b8').text(
        `Gleba · synthèse de pedigree · page ${index + 1}/${pages.count}`,
        M,
        pageH - 49,
        { width: pageW - M * 2, align: 'right', lineBreak: false },
      )
    }

    doc.end()
  })

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="pedigree-${(animal.nom || animal.identifiant || animal.id).toString().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf"`,
    },
  })
}
