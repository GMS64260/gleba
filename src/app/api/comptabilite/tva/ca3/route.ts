/**
 * Pré-remplissage de la déclaration de TVA CA3 (formulaire 3310-CA3).
 *
 * GET /api/comptabilite/tva/ca3?year=2026&trimestre=1&format=pdf|csv
 *
 * Génère un récapitulatif consultable à recopier sur impots.gouv.fr.
 * Mapping des cases (extrait, art. 287 CGI / BOI-TVA-DECLA) :
 *  - 01 : Base HT 20 %
 *  - 02 : Base HT 5.5 %
 *  - 03 : Base HT 10 %
 *  - 08 : TVA collectée 20 %
 *  - 09 : TVA collectée 5.5 %
 *  - 09B : TVA collectée 10 %
 *  - 19 : TVA déductible immobilisations
 *  - 20 : TVA déductible autres biens et services
 *  - 22 : Crédit TVA antérieur
 *  - 23 : TVA déductible totale
 *  - 28 : TVA nette due
 *  - 32 : Crédit de TVA
 *
 * Le calcul reprend strictement la route /api/comptabilite/tva pour
 * cohérence. Le PDF/CSV est marqué « AIDE À LA DÉCLARATION » — la
 * responsabilité de transcription reste de l'expert-comptable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { computeTvaPeriode } from '@/lib/kpi/tva'
import PDFDocument from 'pdfkit'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const format = (searchParams.get('format') || 'pdf').toLowerCase()
  const year = searchParams.get('year') || String(new Date().getFullYear())
  const trimestre = searchParams.get('trimestre') || ''

  // Audit compta 2026-06 : appel direct du helper partagé (avant : fetch HTTP
  // interne vers /api/comptabilite/tva avec cookie — fragile derrière Caddy).
  // Mêmes bornes que la route TVA.
  const yearNum = parseInt(year, 10)
  let startDate: Date
  let endDate: Date
  if (trimestre) {
    const t = parseInt(trimestre, 10)
    startDate = new Date(yearNum, (t - 1) * 3, 1)
    endDate = new Date(yearNum, t * 3, 0, 23, 59, 59)
  } else {
    startDate = new Date(yearNum, 0, 1)
    endDate = new Date(yearNum, 11, 31, 23, 59, 59)
  }
  const tva = await computeTvaPeriode(session!.user.id, startDate, endDate)

  const collectee = tva.collectee.parTaux
  const TAUX_CONNUS = new Set(['0', '2.1', '5.5', '10', '20'])
  // Taux exotiques (ex. 8,5 % DOM) : inclus dans le total case 16 — on les
  // liste à part pour que la somme des bases affichées reste cohérente.
  const autresTaux = Object.entries(collectee)
    .filter(([taux, t]) => !TAUX_CONNUS.has(taux) && (t.base !== 0 || t.tva !== 0))

  // Case 19 : TVA déductible sur immobilisations (catégorie matériel) ;
  // case 20 : le reste des biens et services.
  const tvaImmos = tva.deductible.immobilisations
  const tvaAutresBiens = Math.round((tva.deductible.total - tvaImmos) * 100) / 100

  // Mapping des cases CA3
  const cases: Array<{ code: string; libelle: string; valeur: number }> = [
    { code: '01', libelle: 'Base HT 20 %', valeur: collectee['20']?.base || 0 },
    { code: '02', libelle: 'Base HT 5.5 %', valeur: collectee['5.5']?.base || 0 },
    { code: '03', libelle: 'Base HT 10 %', valeur: collectee['10']?.base || 0 },
    { code: '03B', libelle: 'Base HT 2.1 %', valeur: collectee['2.1']?.base || 0 },
    ...autresTaux.map(([taux, t]) => ({
      code: '—',
      libelle: `Base HT ${taux} % (taux particulier, à ventiler manuellement)`,
      valeur: t.base,
    })),
    { code: '08', libelle: 'TVA collectée 20 %', valeur: collectee['20']?.tva || 0 },
    { code: '09', libelle: 'TVA collectée 5.5 %', valeur: collectee['5.5']?.tva || 0 },
    { code: '09B', libelle: 'TVA collectée 10 %', valeur: collectee['10']?.tva || 0 },
    ...autresTaux.map(([taux, t]) => ({
      code: '—',
      libelle: `TVA collectée ${taux} % (taux particulier)`,
      valeur: t.tva,
    })),
    { code: '16', libelle: 'TVA collectée totale', valeur: tva.collectee.total },
    { code: '19', libelle: 'TVA déductible immobilisations', valeur: tvaImmos },
    { code: '20', libelle: 'TVA déductible autres biens et services', valeur: tvaAutresBiens },
    { code: '23', libelle: 'TVA déductible totale', valeur: tva.deductible.total },
    { code: '28', libelle: 'TVA nette due (Solde à payer)', valeur: tva.solde.tvaAPayer },
    { code: '32', libelle: 'Crédit de TVA', valeur: tva.solde.creditTVA },
  ]

  const filename = `CA3-${year}${trimestre ? `-T${trimestre}` : ''}`

  if (format === 'csv') {
    const lines = [
      `# Aide à la déclaration TVA CA3 — Période ${year}${trimestre ? ` T${trimestre}` : ''}`,
      '# Généré par Gleba — à recopier sur impots.gouv.fr (formulaire 3310-CA3)',
      ...(tva.franchise
        ? ['# ATTENTION : exploitation en franchise en base (art. 293 B CGI) — aucune TVA à déclarer, la CA3 ne vous concerne pas.']
        : []),
      `# nb_inferees_collectees;${tva.details.nbInfereesCollectees}`,
      `# nb_inferees_deductibles;${tva.details.nbInfereesDeductibles}`,
      'case;libelle;valeur_eur',
      ...cases.map((c) => `${c.code};"${c.libelle}";${c.valeur.toFixed(2)}`),
    ]
    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    })
  }

  // Format PDF par défaut
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const chunks: Buffer[] = []
  const buffer: Buffer = await new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(18).fillColor('#0d9488').font('Helvetica-Bold')
    doc.text('Aide à la déclaration TVA CA3', 50, 50)
    doc.fontSize(10).fillColor('#475569').font('Helvetica')
    doc.text(
      `Période : année ${year}${trimestre ? ` — trimestre ${trimestre}` : ' (annuelle)'}`,
      50,
      78
    )
    doc.text(`Émise par : ${session!.user.email}`, 50, 92)
    doc.text(`Générée le ${new Date().toLocaleDateString('fr-FR')}`, 50, 106)

    doc
      .fontSize(9)
      .fillColor('#dc2626')
      .text(
        tva.franchise
          ? '⚠ Votre exploitation est en franchise en base (art. 293 B CGI) : vous ne collectez ni ne déduisez aucune TVA — la déclaration CA3 ne vous concerne pas. Toutes les cases sont à zéro.'
          : '⚠ Aide à la déclaration — les valeurs doivent être recopiées manuellement sur impots.gouv.fr (formulaire 3310-CA3). La conformité reste de la responsabilité de l\'expert-comptable.',
        50,
        128,
        { width: 495 }
      )

    let y = 170
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b')
    doc.text('Case', 50, y, { width: 50 })
    doc.text('Libellé', 110, y, { width: 320 })
    doc.text('Valeur (€)', 430, y, { width: 115, align: 'right' })
    y += 16
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#cbd5e1').lineWidth(0.5).stroke()
    y += 6

    doc.font('Helvetica').fontSize(10).fillColor('#1e293b')
    for (const c of cases) {
      doc.text(c.code, 50, y, { width: 50 })
      doc.text(c.libelle, 110, y, { width: 320 })
      doc.text(c.valeur.toFixed(2), 430, y, { width: 115, align: 'right' })
      y += 14
    }

    y += 12
    if (tva.details.nbInfereesCollectees > 0 || tva.details.nbInfereesDeductibles > 0) {
      doc.fontSize(8).fillColor('#a16207').font('Helvetica-Oblique')
      doc.text(
        `Note : ${tva.details.nbInfereesCollectees} transaction(s) collectée(s) et ${tva.details.nbInfereesDeductibles} transaction(s) déductible(s) ont un taux TVA inféré (pas saisi explicitement). Vérifiez ces lignes avant déclaration.`,
        50,
        y,
        { width: 495 }
      )
    }

    doc.end()
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
    },
  })
}
