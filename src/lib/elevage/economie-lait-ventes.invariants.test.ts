import { describe, expect, it } from 'vitest'
import { projeterVentesFromage, type FactureFromage, type SourcesVentesFromage } from './economie-lait-ventes'

const GRAINE = 20261119
let etat = GRAINE
const entier = (max: number) => { etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0; return etat % max }
const suites = Array.from({ length: 350 }, (_, numero) => ({ numero, lots: Array.from({ length: 1 + entier(5) }, (_, i) => ({
  id: `lot-${i}`, piecesAtelier: 1 + entier(20), piecesBL1: 1 + entier(20), piecesBL2: 1 + entier(20),
  prixCentimes: 1 + entier(3000), factureAuKg: entier(2) === 1, remiseCentimes: entier(100), poidsGrammes: 50 + entier(950),
})) }))
const date = new Date('2025-06-01T12:00:00Z')
const totaux = (s: SourcesVentesFromage) => projeterVentesFromage(s, 'EUR').reduce((r, v) => ({
  centimes: r.centimes + Math.round(v.prixTotal * 100), grammes: r.grammes + Math.round((v.kgVendus ?? Number.NaN) * 1000),
}), { centimes: 0, grammes: 0 })

describe(`P6 — 350 suites générées ; graine fixe ${GRAINE}`, () => {
  it.each(suites)('suite $numero : source facturée unique, avoir/retour distincts, annulation exacte', ({ lots }) => {
    const sources: SourcesVentesFromage = { lots: [], atelier: [], factures: [], mouvements: [] }
    // Oracle indépendant : registre de commandes en centimes et grammes entiers,
    // sans appeler le projecteur ni les règles d'unité/arrondi de production.
    let recette = 0, grammes = 0, remises = 0
    const facturesAtelier: FactureFromage[] = []
    for (const [i, l] of lots.entries()) {
      sources.lots.push({ id: l.id, typeFromage: l.id, nbPieces: 100, poidsTotalKg: l.poidsGrammes / 10 })
      const q = l.piecesBL1 + l.piecesBL2
      recette += (l.piecesAtelier + q) * l.prixCentimes
      grammes += (l.piecesAtelier + q) * l.poidsGrammes
      remises += l.remiseCentimes
      const ligne = (quantite: number, cents: number) => ({ articleStockType: 'fromage', articleStockId: l.id, unite: l.factureAuKg ? 'kg' : 'pièce', quantite: l.factureAuKg ? quantite * l.poidsGrammes / 1000 : quantite, montantTTC: cents / 100 })
      const f: FactureFromage = { id: i + 1, type: 'facture', statut: 'emise', date, factureOrigineId: null, totalTTC: q * l.prixCentimes / 100, emetteurSnapshot: { devise: 'EUR' },
        lignes: [ligne(l.piecesBL1, l.piecesBL1 * l.prixCentimes), ligne(l.piecesBL2, l.piecesBL2 * l.prixCentimes)] }
      sources.factures.push(f)
      sources.atelier.push({ id: i + 1, lotFromageId: l.id, annule: false, factureId: null, date, unite: 'pièce', quantite: l.piecesAtelier, prixTotal: l.piecesAtelier * l.prixCentimes / 100, poidsKg: 0 })
      facturesAtelier.push({ ...f, id: i + 100, totalTTC: l.piecesAtelier * l.prixCentimes / 100, lignes: [ligne(l.piecesAtelier, l.piecesAtelier * l.prixCentimes)] })
      for (const [b, quantite] of [l.piecesBL1, l.piecesBL2].entries()) sources.mouvements.push({ id: `${i}-${b}`, lotFromageId: l.id, date, quantite, unite: 'pièce', poidsKg: quantite * l.poidsGrammes / 1000, factureId: f.id, documentId: `bl-${i}-${b}` })
    }
    expect(totaux(sources)).toEqual({ centimes: recette, grammes })
    // Facturer les ventes atelier ne double ni leurs recettes ni leurs quantités.
    sources.atelier.forEach((v, i) => { v.factureId = facturesAtelier[i].id })
    sources.factures.push(...facturesAtelier)
    expect(totaux(sources)).toEqual({ centimes: recette, grammes })
    for (const [i, l] of lots.entries()) sources.factures.push({ ...sources.factures[i], id: i + 200, type: 'avoir', factureOrigineId: i + 1, totalTTC: l.remiseCentimes / 100,
      lignes: [{ articleStockType: 'fromage', articleStockId: l.id, unite: 'pièce', quantite: l.piecesBL1 + l.piecesBL2, montantTTC: l.remiseCentimes / 100 }] })
    expect(totaux(sources)).toEqual({ centimes: recette - remises, grammes })
    // Une annulation complète et ses retours neutralisent exactement le registre.
    sources.factures.forEach(f => { f.statut = 'annulee' })
    sources.atelier.forEach(v => { v.annule = true })
    sources.mouvements.push(...sources.mouvements.map(m => ({ ...m, id: `retour-${m.id}`, quantite: -m.quantite, poidsKg: -(m.poidsKg ?? 0) })))
    expect(totaux(sources)).toEqual({ centimes: 0, grammes: 0 })
  })
})
