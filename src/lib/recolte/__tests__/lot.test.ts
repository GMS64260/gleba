import { describe, it, expect } from 'vitest'
import { genererNumeroLot, m3PleinToStere, stereToM3Plein } from '../lot'

describe('genererNumeroLot', () => {
  it('formate YYYYMMDD-PARCELLE-ESPECE-NN', () => {
    const lot = genererNumeroLot({
      date: new Date('2026-08-15'),
      parcelleNom: 'Verger Nord',
      espece: 'Pommier',
      numeroSequence: 3,
    })
    expect(lot).toBe('20260815-VergerNo-Pommier-03')
  })

  it('tolère parcelle absente / espèce absente', () => {
    const lot = genererNumeroLot({
      date: new Date('2026-05-14'),
      parcelleNom: null,
      espece: null,
    })
    expect(lot).toBe('20260514-NA-NA-01')
  })

  it('tronque parcelle et espèce à 8 caractères', () => {
    const lot = genererNumeroLot({
      date: new Date('2026-01-02'),
      parcelleNom: 'Verger principal Sud-Est',
      espece: 'Pommier reinette grise du Canada',
    })
    expect(lot).toBe('20260102-Vergerpr-Pommierr-01')
  })

  it('retire caractères spéciaux/accents/espaces du fragment', () => {
    const lot = genererNumeroLot({
      date: new Date('2026-03-10'),
      parcelleNom: 'Île aux fées #1',
      espece: 'Pêcher / Greffé',
    })
    // Accents non-ASCII (Î, é) sont retirés (regex [^A-Za-z0-9])
    expect(lot).toMatch(/^20260310-[A-Za-z0-9]{1,8}-[A-Za-z0-9]{1,8}-01$/)
  })
})

describe('conversion bois m³ / stère', () => {
  it('1 stère = 0.6 m³ plein (bois fendu)', () => {
    expect(stereToM3Plein(1)).toBe(0.6)
    expect(stereToM3Plein(5)).toBe(3)
  })

  it('1 m³ plein ≈ 1.67 stère', () => {
    expect(m3PleinToStere(1)).toBeCloseTo(1.67, 1)
    expect(m3PleinToStere(0.6)).toBe(1)
  })

  it('null → null pour les deux fonctions', () => {
    expect(stereToM3Plein(null)).toBeNull()
    expect(m3PleinToStere(undefined)).toBeNull()
  })

  it('aller-retour conserve la valeur (à l\'arrondi près)', () => {
    const m3 = 4
    const stere = m3PleinToStere(m3)
    expect(stere).not.toBeNull()
    expect(stereToM3Plein(stere!)).toBeCloseTo(m3, 1)
  })
})
