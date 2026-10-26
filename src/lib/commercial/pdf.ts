import PDFDocument from 'pdfkit'
import { terminerPdf } from '@/lib/facturx/pdfa'
import type { EmetteurSnapshot } from '@/lib/facture-utils'
import { dateIsoFacture } from '@/lib/facture-regles'
import { formatPrixUnitaire } from '@/lib/comptabilite/prix-unitaire'
import { mentionFiscale } from '@/lib/territoires'
import { LABELS_STATUT } from './regles'
import type { DocumentComplet } from './service'

/** Documents commerciaux : aucune mention de facture ou de paiement acquis. */
export function genererPdfCommercial(d: DocumentComplet): Promise<Buffer> {
  const e = d.emetteurSnapshot as unknown as EmetteurSnapshot
  const devise = e.devise || 'EUR'
  const montant = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise }).format(n).replace(/\u202f/g, ' ')
  const date = (v: Date) => dateIsoFacture(v).split('-').reverse().join('/')
  const titre = d.type === 'devis' ? 'DEVIS' : 'BON DE LIVRAISON'
  const doc = new PDFDocument({ size: 'A4', margin: 45, info: { Title: `${titre} ${d.numero}`, Author: e.raisonSociale } })
  return terminerPdf(doc, () => {
    let y = 45
    const place = (h: number) => {
      if (y + h > 780) { doc.addPage(); y = 45 }
    }
    const texte = (s: string, taille = 10, gras = false) => {
      doc.font(gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(taille)
      const hauteur = doc.heightOfString(s, { width: 505 })
      place(Math.min(hauteur + 8, 700))
      doc.text(s, 45, y, { width: 505 })
      y = doc.y + 8
    }
    doc.fillColor('#0f766e')
    texte(titre, d.type === 'devis' ? 25 : 20, true)
    doc.fillColor('#1e293b')
    texte(`${d.statut === 'brouillon' ? 'BROUILLON · ' : ''}${d.numero} · ${date(d.date)} · ${LABELS_STATUT[d.statut] || d.statut}`, 10)
    texte(e.raisonSociale, 13, true)
    texte([e.formeJuridique, e.adresseSiege, `${e.codePostal} ${e.ville}`, e.pays,
      e.siret ? `SIRET ${e.siret}` : e.identifiantLegal, e.numeroTvaIntracom ? `TVA ${e.numeroTvaIntracom}` : '',
      e.emailContact, e.telContact].filter(Boolean).join('\n'), 9)
    y += 5
    texte('CLIENT', 9, true)
    texte([d.clientNom, d.clientAdresse, d.clientEmail,
      d.clientSiret ? `SIRET ${d.clientSiret}` : d.clientSiren ? `SIREN ${d.clientSiren}` : '',
      d.clientTvaIntra ? `TVA ${d.clientTvaIntra}` : ''].filter(Boolean).join('\n'))
    texte(d.objet, 12, true)
    if (d.dateValidite) texte(`Offre valable jusqu’au ${date(d.dateValidite)} inclus.`)
    if (d.dateLivraison) texte(`${d.statut === 'livre' ? 'Livraison effectuée' : 'Livraison prévue'} le ${date(d.dateLivraison)}`)
    if (d.adresseLivraison) texte(`Adresse de livraison : ${d.adresseLivraison}`)
    if (d.devisOrigine) texte(`Devis d’origine : ${d.devisOrigine.numero}`)
    const entete = () => {
      place(28)
      doc.rect(45, y, 505, 22).fill('#f1f5f9')
      doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8)
      for (const [label, x, w] of [['Désignation', 50, 205], ['Quantité', 260, 65], ['PU HT', 330, 65], ['TVA', 400, 45], ['Total TTC', 450, 95]] as const) {
        doc.text(label, x, y + 7, { width: w, align: x === 50 ? 'left' : 'right' })
      }
      y += 28
    }
    entete()
    for (const l of d.lignes) {
      doc.font('Helvetica').fontSize(9)
      const h = Math.max(doc.heightOfString(l.description, { width: 205 }), 22) + 12
      if (y + h > 760) { doc.addPage(); y = 45; entete() }
      doc.font('Helvetica').fontSize(9)
      doc.fillColor('#1e293b').text(l.description, 50, y, { width: 205 })
      doc.text(`${l.quantite.toLocaleString('fr-FR')} ${l.unite}`, 260, y, { width: 65, align: 'right' })
      doc.text(formatPrixUnitaire(l.prixUnitaire, devise), 330, y, { width: 65, align: 'right' })
      doc.text(`${l.tauxTVA.toLocaleString('fr-FR')} %`, 400, y, { width: 45, align: 'right' })
      doc.text(montant(l.montantTTC), 450, y, { width: 95, align: 'right' })
      y += h
      doc.moveTo(45, y - 5).lineTo(550, y - 5).strokeColor('#e2e8f0').stroke()
    }
    texte(`Total HT : ${montant(d.totalHT)}\nTVA : ${montant(d.totalTVA)}\nTotal TTC : ${montant(d.totalTTC)}`, 12, true)
    const fiscal = mentionFiscale(e.regimeTva)
    if (fiscal) texte(fiscal, 9)
    if (d.clientExonere && !fiscal) texte('Client exonéré de TVA.', 9)
    if (d.notes) { texte('Conditions et notes', 10, true); texte(d.notes, 9) }
    if (d.type === 'devis') {
      texte('Bon pour accord : date, nom et signature du client', 10, true)
      place(50); y += 50
      if (d.dateAcceptation) texte(`Acceptation enregistrée dans Gleba le ${date(d.dateAcceptation)}. Conservez le devis signé ou la preuve de l’accord.`, 9)
    } else {
      texte('Réception : date, nom, signature et réserves éventuelles', 10, true)
      place(50); y += 50
      texte('Ce bon de livraison ne vaut pas facture ni preuve de règlement.', 9)
    }
    if (d.facture) texte(`Facture liée : ${d.facture.numero}`, 9)
  })
}
