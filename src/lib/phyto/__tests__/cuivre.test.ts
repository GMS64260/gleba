import { describe, it, expect } from 'vitest'
import {
  isProduitCuivre,
  doseCuivreMetalKg,
  cumuleParParcelle,
  PLAFOND_CU_KG_HA_AN,
  PLAFOND_CU_KG_HA_7ANS,
} from '../cuivre'

describe('isProduitCuivre', () => {
  it('détecte le flag explicite contientCuivre', () => {
    expect(isProduitCuivre({ contientCuivre: true })).toBe(true)
  })

  it('détecte par classification Chimique cuivré', () => {
    expect(isProduitCuivre({ classification: 'Chimique cuivré' })).toBe(true)
  })

  it('détecte Bouillie bordelaise par le nom', () => {
    expect(isProduitCuivre({ nomCommercial: 'Bouillie bordelaise RSR' })).toBe(true)
  })

  it('détecte par substance active "Hydroxyde de cuivre"', () => {
    expect(isProduitCuivre({ substanceActive: 'Hydroxyde de cuivre 30%' })).toBe(true)
  })

  it('refuse un produit non cuivré', () => {
    expect(isProduitCuivre({ nomCommercial: 'Savon noir', classification: 'Biocontrôle' })).toBe(false)
    expect(isProduitCuivre(null)).toBe(false)
    expect(isProduitCuivre(undefined)).toBe(false)
  })
})

describe('doseCuivreMetalKg', () => {
  it('Bouillie bordelaise 5 kg/ha sur 2 ha → 2 kg Cu métal (20% par défaut)', () => {
    const cu = doseCuivreMetalKg({
      date: new Date('2026-04-08'),
      parcelleId: 'P1',
      surfaceHa: 2,
      doseAppliquee: 5,
      uniteDose: 'kg/ha',
      volumeBouillieLHa: null,
      produit: { nomCommercial: 'Bouillie bordelaise', cuivreMetalPct: 20 },
    })
    // 5 × 2 = 10 kg produit, × 20% = 2 kg Cu
    expect(cu).toBeCloseTo(2, 2)
  })

  it("Hydroxyde de cuivre 30%, 3 kg/ha sur 1 ha → 0.9 kg Cu", () => {
    const cu = doseCuivreMetalKg({
      date: new Date('2026-05-01'),
      parcelleId: 'P1',
      surfaceHa: 1,
      doseAppliquee: 3,
      uniteDose: 'kg/ha',
      volumeBouillieLHa: null,
      produit: { contientCuivre: true, cuivreMetalPct: 30 },
    })
    expect(cu).toBeCloseTo(0.9, 2)
  })

  it("retourne 0 si le produit n'est pas cuivré", () => {
    const cu = doseCuivreMetalKg({
      date: new Date('2026-04-08'),
      parcelleId: 'P1',
      surfaceHa: 2,
      doseAppliquee: 5,
      uniteDose: 'kg/ha',
      volumeBouillieLHa: null,
      produit: { nomCommercial: 'Savon noir' },
    })
    expect(cu).toBe(0)
  })

  it('retourne 0 si surface ou dose manquantes', () => {
    expect(
      doseCuivreMetalKg({
        date: new Date(),
        parcelleId: 'P1',
        surfaceHa: null,
        doseAppliquee: 5,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: { contientCuivre: true },
      })
    ).toBe(0)
    expect(
      doseCuivreMetalKg({
        date: new Date(),
        parcelleId: 'P1',
        surfaceHa: 1,
        doseAppliquee: 0,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: { contientCuivre: true },
      })
    ).toBe(0)
  })
})

describe('cumuleParParcelle', () => {
  const surfaces = new Map([['P1', 2], ['P2', 1]])
  const bouillie = { contientCuivre: true, cuivreMetalPct: 20 }

  it('cumule sur l\'année courante par parcelle', () => {
    const traitements = [
      {
        date: new Date('2026-04-08'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 5,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
      {
        date: new Date('2026-05-12'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 3,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
      {
        date: new Date('2026-04-15'),
        parcelleId: 'P2',
        surfaceHa: 1,
        doseAppliquee: 2,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
    ]
    const cumuls = cumuleParParcelle(traitements, surfaces, new Date('2026-06-01'))
    const p1 = cumuls.find((c) => c.parcelleId === 'P1')!
    const p2 = cumuls.find((c) => c.parcelleId === 'P2')!
    // P1 : 5+3 = 8 kg produit × 2 ha × 20% = 3.2 kg Cu => 1.6 kg/ha/an
    expect(p1.cumulAnnuelKg).toBeCloseTo(3.2, 2)
    expect(p1.cuivreKgParHaAn).toBeCloseTo(1.6, 2)
    // P2 : 2 × 1 × 20% = 0.4 kg Cu => 0.4 kg/ha/an
    expect(p2.cumulAnnuelKg).toBeCloseTo(0.4, 2)
    expect(p2.statut).toBe('ok')
  })

  it('alerte warn à 75% du plafond annuel', () => {
    // 4 kg/ha/an × 0.75 = 3 kg/ha → 6 kg sur 2 ha
    const traitements = [
      {
        date: new Date('2026-04-01'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 15, // 15 kg × 2 ha × 20% = 6 kg Cu = 3 kg/ha
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
    ]
    const cumuls = cumuleParParcelle(traitements, surfaces, new Date('2026-06-01'))
    const p1 = cumuls.find((c) => c.parcelleId === 'P1')!
    expect(p1.cuivreKgParHaAn).toBeCloseTo(3, 2)
    expect(p1.statut).toBe('warn')
  })

  it('alerte alert à 100% du plafond annuel', () => {
    const traitements = [
      {
        date: new Date('2026-04-01'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 20, // 20 × 2 × 20% = 8 kg Cu = 4 kg/ha
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
    ]
    const cumuls = cumuleParParcelle(traitements, surfaces, new Date('2026-06-01'))
    const p1 = cumuls.find((c) => c.parcelleId === 'P1')!
    expect(p1.cuivreKgParHaAn).toBeCloseTo(PLAFOND_CU_KG_HA_AN, 2)
    expect(p1.statut).toBe('alert')
  })

  it("cumul 7 ans glissants : inclut les 7 dernières années jusqu'au jour", () => {
    const traitements = [
      // Vieux 2017 : exclu (>7 ans avant 2026-05-14)
      {
        date: new Date('2017-04-01'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 10,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
      // Inclus
      {
        date: new Date('2020-04-01'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 10,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
      {
        date: new Date('2026-04-01'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 5,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
    ]
    const cumuls = cumuleParParcelle(traitements, surfaces, new Date('2026-05-14'))
    const p1 = cumuls.find((c) => c.parcelleId === 'P1')!
    // 7 ans glissants : 2020 (10×2×0.2 = 4) + 2026 (5×2×0.2 = 2) = 6 kg Cu / 2 ha = 3 kg/ha
    expect(p1.cumul7ansKg).toBeCloseTo(6, 2)
    expect(p1.cuivreKgParHa7ans).toBeCloseTo(3, 2)
    // Plafond 7 ans = 28 kg/ha → 3 kg/ha = OK
    expect(p1.statut).toBe('ok')
  })

  it('plafond 7 ans (28 kg/ha) dimensionne aussi l\'alerte', () => {
    // 1 traitement énorme 14 kg/ha cette année
    const traitements = [
      {
        date: new Date('2026-04-01'),
        parcelleId: 'P1',
        surfaceHa: 1,
        doseAppliquee: 70, // 70 × 1 × 20% = 14 kg Cu, mais surface 1 ha → 14 kg/ha
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
    ]
    const cumuls = cumuleParParcelle(traitements, new Map([['P1', 1]]), new Date('2026-06-01'))
    const p1 = cumuls.find((c) => c.parcelleId === 'P1')!
    // 14/4 = 350% annuel = alert
    expect(p1.statut).toBe('alert')
    // 14/28 = 50% 7ans
    expect(p1.cuivreKgParHa7ans / PLAFOND_CU_KG_HA_7ANS).toBeCloseTo(0.5, 2)
  })
})
