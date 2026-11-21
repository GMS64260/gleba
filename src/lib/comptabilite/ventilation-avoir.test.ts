/**
 * COM-04 : les lignes d'avoir construites par l'écran suivent la ventilation
 * par taux de la facture d'origine et passent les plafonds du serveur.
 */
import { describe, expect, it } from 'vitest'
import { lignesAvoirVentile, ventilationOrigine } from './ventilation-avoir'
import { refusPlafondsAvoir } from './plafonds-avoir'

const ORIGINE = [
  { tauxTVA: 20, montantHT: 100, montantTVA: 20, montantTTC: 120 },
  { tauxTVA: 5.5, montantHT: 100, montantTVA: 5.5, montantTTC: 105.5 },
]

describe('ventilation d’un avoir multi-taux', () => {
  it('regroupe l’origine par taux', () => {
    expect(ventilationOrigine(ORIGINE)).toEqual([
      { taux: 20, ht: 100, tva: 20, ttc: 120, lignes: [{ montantHT: 100, montantTVA: 20, montantTTC: 120 }] },
      { taux: 5.5, ht: 100, tva: 5.5, ttc: 105.5, lignes: [{ montantHT: 100, montantTVA: 5.5, montantTTC: 105.5 }] },
    ])
  })

  it('avoir total : reprend exactement HT et TVA de l’origine, solde de TVA nul', () => {
    const origine = ventilationOrigine(ORIGINE)
    const lignes = lignesAvoirVentile(origine, { '20': 120, '5.5': 105.5 }, 'Retour')
    expect(lignes.map((l) => [l.tauxTVA, l.montantHT, l.montantTVA, l.montantTTC])).toEqual([
      [20, 100, 20, 120],
      [5.5, 100, 5.5, 105.5],
    ])
    const tva = lignes.reduce((s, l) => s + Math.round(l.montantTVA * 100), 0)
    expect(tva).toBe(2550)
    expect(refusPlafondsAvoir(ORIGINE, [], lignes)).toBeNull()
  })

  it('avoir partiel : chaque ligne vérifie HT + TVA = TTC et passe les plafonds', () => {
    const lignes = lignesAvoirVentile(ventilationOrigine(ORIGINE), { '20': 24.99, '5.5': 0 }, 'Geste')
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ tauxTVA: 20, montantHT: 20.83, montantTVA: 4.16, montantTTC: 24.99 })
    expect(refusPlafondsAvoir(ORIGINE, [], lignes)).toBeNull()
  })

  it('le serveur refuse l’ancien avoir total au premier taux', () => {
    const refus = refusPlafondsAvoir(ORIGINE, [], [{ tauxTVA: 20, montantHT: 187.92, montantTVA: 37.58, montantTTC: 225.5 }])
    expect(refus).toMatch(/20 %/)
  })

  // Huit lignes de 3,50 € HT à 5,5 % : TVA de 0,19 € par ligne, soit 1,52 €
  // au cumul, alors que 28 € × 5,5 % = 1,54 €.
  const HUIT = Array.from({ length: 8 }, () => ({ tauxTVA: 5.5, montantHT: 3.5, montantTVA: 0.19, montantTTC: 3.69 }))
  const coherente = (l: { tauxTVA: number; montantHT: number; montantTVA: number; montantTTC: number }) =>
    Math.abs(l.montantHT + l.montantTVA - l.montantTTC) < 0.005 && Math.abs(l.montantHT * l.tauxTVA / 100 - l.montantTVA) < 0.01

  it('avoir total d’un taux à plusieurs lignes : reprend les lignes une à une, TVA identique à l’origine', () => {
    const origine = [...HUIT, { tauxTVA: 20, montantHT: 10, montantTVA: 2, montantTTC: 12 }]
    const lignes = lignesAvoirVentile(ventilationOrigine(origine), { '5.5': 29.52, '20': 12 }, 'Retour')
    expect(lignes).toHaveLength(9)
    expect(lignes.every(coherente)).toBe(true)
    expect(lignes.reduce((s, l) => s + Math.round(l.montantTVA * 100), 0)).toBe(352)
    expect(refusPlafondsAvoir(origine, [], lignes)).toBeNull()
  })

  it('facture à un seul taux et plusieurs lignes : l’avoir total passe, puis plus rien ne reste', () => {
    const lignes = lignesAvoirVentile(ventilationOrigine(HUIT), { '5.5': 29.52 }, 'Retour', false)
    expect(lignes).toHaveLength(8)
    expect(lignes[0].description).toBe('Retour')
    expect(refusPlafondsAvoir(HUIT, [], lignes)).toBeNull()
    expect(refusPlafondsAvoir(HUIT, lignes, [{ tauxTVA: 5.5, montantHT: 0.95, montantTVA: 0.05, montantTTC: 1 }])).toMatch(/il reste 0,00 TTC/)
  })

  it('avoir partiel puis le reste : le second passe malgré les arrondis', () => {
    const o = ventilationOrigine(HUIT)
    const premier = lignesAvoirVentile(o, { '5.5': 10 }, 'Geste')
    const reste = lignesAvoirVentile(o, { '5.5': 19.52 }, 'Solde')
    expect(refusPlafondsAvoir(HUIT, premier, reste)).toBeNull()
  })

  it('un ancien avoir saisi au mauvais taux n’interdit pas un avoir juste sur un autre taux', () => {
    const ancien = [{ tauxTVA: 20, montantHT: 125, montantTVA: 25, montantTTC: 150 }]
    const reste = lignesAvoirVentile(ventilationOrigine(ORIGINE), { '5.5': 75.5 }, 'Solde')
    expect(refusPlafondsAvoir(ORIGINE, ancien, reste)).toBeNull()
  })

  it('facture d’origine sans ligne (historique) : aucun plafond par taux', () => {
    expect(refusPlafondsAvoir([], [], [{ tauxTVA: 20, montantHT: 10, montantTVA: 2, montantTTC: 12 }])).toBeNull()
  })
})
