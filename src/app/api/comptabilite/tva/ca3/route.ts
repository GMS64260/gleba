/**
 * Pré-remplissage de la déclaration de TVA CA3 (formulaire 3310-CA3).
 *
 * GET /api/comptabilite/tva/ca3?year=2026&trimestre=1&format=pdf|csv
 *
 * Génère un récapitulatif des montants de la période, SANS numéro de case :
 * l'ancienne correspondance était fausse au regard du formulaire en vigueur
 * (le crédit de TVA était annoncé en case 32, qui est le total à payer ; les
 * bases par taux visaient d'autres lignes), au risque d'une recopie en sens
 * inverse (revue du 2026-11-11). Ne réintroduire des numéros de case qu'avec
 * une correspondance vérifiée sur le formulaire officiel de l'année.
 *
 * Le calcul reprend strictement la route /api/comptabilite/tva pour
 * cohérence. Le PDF/CSV est marqué « AIDE À LA DÉCLARATION » — la
 * responsabilité de transcription reste de l'expert-comptable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { dispositionDocument } from "@/lib/http/disposition-fichier"
import { requireAuthApi } from '@/lib/auth-utils'
import { computeTvaPeriode } from '@/lib/kpi/tva'
import { motifHorsChampCa3 } from '@/lib/territoires'
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
  // Taux exotiques (ex. 8,5 % DOM) : inclus dans la TVA collectée totale — on les
  // liste à part pour que la somme des bases affichées reste cohérente.
  const autresTaux = Object.entries(collectee)
    .filter(([taux, t]) => !TAUX_CONNUS.has(taux) && (t.base !== 0 || t.tva !== 0))

  // Case 19 : TVA déductible sur immobilisations (catégorie matériel) ;
  // case 20 : le reste des biens et services.
  const tvaImmos = tva.deductible.immobilisations
  const tvaAutresBiens = Math.round((tva.deductible.total - tvaImmos) * 100) / 100

  // Montants de la période, sans numéro de case (voir l'en-tête).
  const cases: Array<{ libelle: string; valeur: number }> = [
    { libelle: 'Base HT 20 %', valeur: collectee['20']?.base || 0 },
    { libelle: 'Base HT 5.5 %', valeur: collectee['5.5']?.base || 0 },
    { libelle: 'Base HT 10 %', valeur: collectee['10']?.base || 0 },
    { libelle: 'Base HT 2.1 %', valeur: collectee['2.1']?.base || 0 },
    ...autresTaux.map(([taux, t]) => ({
      libelle: `Base HT ${taux} % (taux particulier, à ventiler manuellement)`,
      valeur: t.base,
    })),
    { libelle: 'TVA collectée 20 %', valeur: collectee['20']?.tva || 0 },
    { libelle: 'TVA collectée 5.5 %', valeur: collectee['5.5']?.tva || 0 },
    { libelle: 'TVA collectée 10 %', valeur: collectee['10']?.tva || 0 },
    ...autresTaux.map(([taux, t]) => ({
      libelle: `TVA collectée ${taux} % (taux particulier)`,
      valeur: t.tva,
    })),
    { libelle: 'TVA collectée totale', valeur: tva.collectee.total },
    { libelle: 'TVA déductible immobilisations', valeur: tvaImmos },
    { libelle: 'TVA déductible autres biens et services', valeur: tvaAutresBiens },
    { libelle: 'TVA déductible totale', valeur: tva.deductible.total },
    { libelle: 'TVA nette due (solde à payer)', valeur: tva.solde.tvaAPayer },
    { libelle: 'Crédit de TVA', valeur: tva.solde.creditTVA },
  ]

  const filename = `CA3-${year}${trimestre ? `-T${trimestre}` : ''}`

  if (format === 'csv') {
    const lines = [
      `# Aide à la déclaration TVA CA3 — Période ${year}${trimestre ? ` T${trimestre}` : ''}`,
      '# Généré par Gleba — montants de la période, sans numéro de case : reportez chaque montant dans la ligne correspondante du formulaire 3310-CA3 en vigueur',
      ...(tva.franchise
        ? [`# ATTENTION : ${motifHorsChampCa3(tva.regimeTva) ?? 'exploitation hors champ de la CA3 — aucune TVA à déclarer.'}`]
        : []),
      `# nb_inferees_collectees;${tva.details.nbInfereesCollectees}`,
      `# nb_inferees_deductibles;${tva.details.nbInfereesDeductibles}`,
      'libelle;valeur_eur',
      ...cases.map((c) => `"${c.libelle}";${c.valeur.toFixed(2)}`),
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
          ? `⚠ ${motifHorsChampCa3(tva.regimeTva) ?? 'Votre exploitation est hors champ de la CA3.'} Tous les montants sont à zéro.`
          : '⚠ Aide à la déclaration — montants de la période, sans numéro de case : reportez chaque montant dans la ligne correspondante du formulaire 3310-CA3 en vigueur sur impots.gouv.fr. La conformité reste de la responsabilité de l\'expert-comptable.',
        50,
        128,
        { width: 495 }
      )

    let y = 170
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b')
    doc.text('Libellé', 50, y, { width: 380 })
    doc.text('Valeur (€)', 430, y, { width: 115, align: 'right' })
    y += 16
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#cbd5e1').lineWidth(0.5).stroke()
    y += 6

    doc.font('Helvetica').fontSize(10).fillColor('#1e293b')
    for (const c of cases) {
      doc.text(c.libelle, 50, y, { width: 380 })
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
      'Content-Disposition': dispositionDocument(request, `${filename}.pdf`),
    },
  })
}
