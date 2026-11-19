import { describe, expect, it } from 'vitest'
import {
  ErreurVentilationFromage, projeterVentesFromage,
  type FactureFromage, type PieceEcarteeFromage, type SourcesVentesFromage,
} from './economie-lait-ventes'

/**
 * Contre-revue du 2026-11-19 : une seule facture non ventilable (frais de port
 * ajoutés au total d'une ancienne facture d'atelier) rendait le bilan de tout
 * l'exercice indisponible (422).
 */
const date = new Date('2026-05-10T12:00:00Z')
const facture = (id: number, numero: string, totalTTC: number, extra: Partial<FactureFromage> = {}): FactureFromage => ({
  id, numero, type: 'facture', statut: 'emise', date, factureOrigineId: null, totalTTC,
  emetteurSnapshot: { devise: 'EUR' }, lignes: [], ...extra,
})
const sources = (): SourcesVentesFromage => ({
  lots: [
    { id: 'tomme', typeFromage: 'Tomme', nbPieces: 20, poidsTotalKg: 20 },
    { id: 'crottin', typeFromage: 'Crottin', nbPieces: 50, poidsTotalKg: 5 },
  ],
  atelier: [
    // Facture saine : le total égale la vente d'atelier.
    { id: 1, lotFromageId: 'tomme', date, annule: false, factureId: 10, quantite: 2, unite: 'pièce', prixTotal: 40, poidsKg: 2 },
    // Facture avec 6 € de port : total 31 € pour 25 € de ventes d'atelier.
    { id: 2, lotFromageId: 'crottin', date, annule: false, factureId: 11, quantite: 10, unite: 'pièce', prixTotal: 25, poidsKg: 1 },
  ],
  mouvements: [],
  factures: [facture(10, 'F-2026-0010', 40), facture(11, 'F-2026-0011', 31)],
})

describe('bilan du lait : pièces non ventilables', () => {
  it('sans collecteur, le calcul refuse toujours (comptabilité des stocks)', () => {
    expect(() => projeterVentesFromage(sources(), 'EUR')).toThrow(ErreurVentilationFromage)
  })

  it('avec collecteur, le bilan garde les pièces ventilables et nomme la pièce écartée', () => {
    const ecartees: PieceEcarteeFromage[] = []
    const ventes = projeterVentesFromage(sources(), 'EUR', undefined, false, ecartees)
    expect(ecartees).toEqual([
      { factureId: 11, numero: 'F-2026-0011', type: 'facture', motif: expect.stringContaining('Recettes non réparties'), typesFromage: ['Crottin'] },
    ])
    const parLot = Object.fromEntries(ventes.map((v) => [v.lotFromageId, v]))
    expect(parLot.tomme).toMatchObject({ prixTotal: 40, quantite: 2 })
    // Les quantités vendues restent connues ; seule la recette de la pièce manque.
    expect(parLot.crottin).toMatchObject({ prixTotal: 0, quantite: 10 })
    expect(ventes.some((v) => v.avertissementValorisation)).toBe(false)
  })

  // Contre-revue du lot : l'avoir d'une facture écartée passait par elle et
  // retranchait 31 € d'une recette qui n'avait pas été comptée.
  it('écarte aussi l’avoir d’une facture écartée, quel que soit l’ordre de lecture', () => {
    const s = sources()
    s.factures.unshift(facture(12, 'A-2026-0012', 31, { type: 'avoir', factureOrigineId: 11,
      lignes: [{ articleStockType: null, articleStockId: null, unite: 'pièce', quantite: 1, montantTTC: 31 }] }))
    const ecartees: PieceEcarteeFromage[] = []
    const ventes = projeterVentesFromage(s, 'EUR', undefined, false, ecartees)
    expect(ecartees.map((p) => [p.numero, p.type])).toEqual([['F-2026-0011', 'facture'], ['A-2026-0012', 'avoir']])
    expect(ventes.find((v) => v.lotFromageId === 'crottin')?.prixTotal).toBe(0)
  })

  it('écarte aussi une pièce émise dans une autre devise, en entier', () => {
    const s = sources()
    s.factures = [facture(10, 'F-2026-0010', 40), facture(12, 'F-2026-0012', 25, { emetteurSnapshot: { devise: 'XPF' } })]
    s.atelier[1].factureId = 12
    const ecartees: PieceEcarteeFromage[] = []
    projeterVentesFromage(s, 'EUR', undefined, false, ecartees)
    expect(ecartees.map((p) => [p.numero, p.motif])).toEqual([['F-2026-0012', expect.stringContaining('Devise de la pièce')]])
  })
})
