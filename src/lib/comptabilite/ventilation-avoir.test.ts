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
      { taux: 20, ht: 100, tva: 20, ttc: 120 },
      { taux: 5.5, ht: 100, tva: 5.5, ttc: 105.5 },
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
})
