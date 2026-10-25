/**
 * Ticket QA cmvnpe6ip (2026-10-25) — Gestion des stocks > Récoltes : Radis
 * compté 7,5 kg le 25/10/2026 ; Récoltes > Stock : quatre lots de 2 kg.
 * La comparaison dit la différence et ce que les données établissent, sans
 * attribuer de cause (revue du 2026-10-25).
 */
import { describe, expect, it } from 'vitest'
import {
  comparaisonADire,
  comparerStockEtLots,
  ecartSignificatif,
  lignesComparaison,
  LIMITE_GESTION_STOCKS,
  seuilEcart,
  type LotEnStock,
  type StockGestion,
} from '../rapprochement-recoltes'

// Midi UTC : même jour civil de Nouméa à Papeete.
const COMPTAGE = new Date('2026-10-25T12:00:00.000Z')
const lot = (jour: string, quantite: number, over: Partial<LotEnStock> = {}): LotEnStock => ({
  date: new Date(`${jour}T00:00:00.000Z`),
  quantite,
  unite: null,
  enBoutique: false,
  ...over,
})
const quatreLots = [lot('2026-10-05', 2), lot('2026-10-12', 2), lot('2026-10-19', 2), lot('2026-10-24', 2)]
/** Ce que `calculerStocksNet` rend pour le radis compté 7,5 kg, sans lot postérieur. */
const radisCompte: StockGestion = {
  stockNet: 7.5,
  unite: 'kg',
  dateInventaire: COMPTAGE,
  detail: { consommations: 0 },
}

describe('comparerStockEtLots', () => {
  it('ticket : 7,5 kg contre 8 kg de lots, écart de −0,5 kg sans cause supposée', () => {
    const c = comparerStockEtLots(radisCompte, quatreLots)

    expect(c).toMatchObject({ stockGestion: 7.5, lotsEnStock: 8, ecart: -0.5, vendusDepuisComptage: 0 })
    expect(lignesComparaison(c)).toEqual({
      ligne: 'Gestion des stocks : 7,5 kg (comptage du 25/10/2026) · lots en stock : 8 kg · écart : −0,5 kg',
      complements: [],
    })
  })

  it('revue : un lot daté avant le comptage et vendu après est nommé, pas pris pour un ajustement', () => {
    // Le lot du 05/10 est vendu le 26/10 : Gestion des stocks reste à 7,5 kg
    // (le comptage l'a absorbé), les lots en stock tombent à 6 kg.
    const enStock = quatreLots.slice(1)
    const vendus = [{ date: quatreLots[0].date, dateVente: new Date('2026-10-26T10:00:00.000Z'), quantite: 2, unite: null }]

    const c = comparerStockEtLots(radisCompte, enStock, vendus)

    expect(c).toMatchObject({ lotsEnStock: 6, ecart: 1.5, vendusDepuisComptage: 2 })
    const { ligne, complements } = lignesComparaison(c)
    expect(ligne).toBe('Gestion des stocks : 7,5 kg (comptage du 25/10/2026) · lots en stock : 6 kg · écart : +1,5 kg')
    expect(complements).toEqual(['dont 2 kg vendus depuis le comptage, non déduits de Gestion des stocks'])
    expect([ligne, ...complements].join(' ')).not.toMatch(/ajustement/i)
  })

  it("une vente datée avant le comptage (le comptage l'a déjà vue) n'est pas nommée", () => {
    const vendus = [{ date: quatreLots[0].date, dateVente: new Date('2026-10-20T10:00:00.000Z'), quantite: 2, unite: null }]
    expect(comparerStockEtLots(radisCompte, quatreLots, vendus).vendusDepuisComptage).toBe(0)
  })

  it('récolte saisie le jour du comptage, après lui : écart dit, aucune composante inventée', () => {
    // Datée du 25/10 à minuit, donc « avant » le comptage pour Gestion des
    // stocks, qui ne l'ajoute pas ; elle est bien en stock côté lots.
    const c = comparerStockEtLots(radisCompte, [...quatreLots, lot('2026-10-25', 3)])

    expect(c).toMatchObject({ lotsEnStock: 11, ecart: -3.5, vendusDepuisComptage: 0, lotsEnBoutique: 0 })
    expect(lignesComparaison(c).complements).toEqual([])
    expect(LIMITE_GESTION_STOCKS).toContain("une récolte datée du jour du comptage ou d'avant n'y est pas ajoutée")
  })

  it('sans comptage : sorties de Consommations et lots en boutique nommés', () => {
    const lots = [...quatreLots, lot('2026-10-27', 1.5, { enBoutique: true })]
    // calculerStocksNet : 8 (lots hors boutique) − 1,2 de Consommations.
    const stock: StockGestion = { stockNet: 6.8, unite: 'kg', dateInventaire: null, detail: { consommations: 1.2 } }

    const c = comparerStockEtLots(stock, lots)

    expect(c.ecart).toBe(-2.7)
    expect(lignesComparaison(c)).toEqual({
      ligne: 'Gestion des stocks : 6,8 kg (sans comptage) · lots en stock : 9,5 kg · écart : −2,7 kg',
      complements: [
        'dont 1,2 kg de sorties saisies dans Consommations, sur aucun lot',
        'dont 1,5 kg de lots en boutique, hors Gestion des stocks',
      ],
    })
  })

  it('tiges : « comptage du … · lots en stock : 20 tiges · écart : +5 tiges »', () => {
    const stock: StockGestion = { stockNet: 25, unite: 'tige', dateInventaire: COMPTAGE, detail: { consommations: 0 } }
    const c = comparerStockEtLots(stock, [lot('2026-10-20', 20, { unite: 'tige' })])
    expect(lignesComparaison(c).ligne).toBe(
      'Gestion des stocks : 25 tiges (comptage du 25/10/2026) · lots en stock : 20 tiges · écart : +5 tiges',
    )
  })

  it("lots d'une autre unité : nommés, hors écart", () => {
    const stock: StockGestion = { stockNet: 8, unite: 'kg', dateInventaire: null, detail: { consommations: 0 } }
    const c = comparerStockEtLots(stock, [...quatreLots, lot('2026-10-29', 12, { unite: 'botte' })])

    expect(c.ecart).toBe(0)
    expect(comparaisonADire(c)).toBe(true)
    expect(lignesComparaison(c).complements).toEqual(['lots dans une autre unité, hors Gestion des stocks : 12 bottes'])
  })
})

describe("seuils d'écart par unité", () => {
  it('5 g pour le kilo, une demi-pièce pour ce qui se compte', () => {
    expect(seuilEcart('kg')).toBe(0.005)
    expect(seuilEcart('tige')).toBe(0.5)
    expect(ecartSignificatif(0.004, 'kg')).toBe(false)
    expect(ecartSignificatif(-0.005, 'kg')).toBe(true)
    expect(ecartSignificatif(0.4, 'piece')).toBe(false)
    expect(ecartSignificatif(1, 'botte')).toBe(true)
  })

  it('un écart sous le seuil ne fait rien afficher', () => {
    const c = comparerStockEtLots({ ...radisCompte, stockNet: 7.996 }, quatreLots.map((l) => ({ ...l, date: '2026-10-26' })))
    expect(c.ecart).toBe(0)
    expect(comparaisonADire(c)).toBe(false)
  })
})
