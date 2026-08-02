import { describe, expect, it } from 'vitest'
import { normalizeCultureDateFields } from '../culture'

describe('normalizeCultureDateFields', () => {
  it('convertit les dates « YYYY-MM-DD » des inputs type=date en Date', () => {
    // Bug utilisateur 2026-08-02 : ces chaînes partaient telles quelles à
    // Prisma (« premature end of input ») et l'édition échouait en 500.
    const data = { dateSemis: '2026-08-15', dateRecolte: '2026-12-05' }
    expect(normalizeCultureDateFields(data)).toBeNull()
    expect(data.dateSemis).toBeInstanceOf(Date)
    expect((data.dateSemis as unknown as Date).getFullYear()).toBe(2026)
    expect(data.dateRecolte).toBeInstanceOf(Date)
  })

  it('laisse intacts les ISO complets, les Date et les absents', () => {
    const iso = '2026-11-15T23:00:00.000Z'
    const deja = new Date('2026-05-01')
    const data = { dateSemis: iso, datePlantation: deja, dateRecolte: null }
    expect(normalizeCultureDateFields(data)).toBeNull()
    expect((data.dateSemis as unknown as Date).toISOString()).toBe(iso)
    expect(data.datePlantation).toBe(deja)
    expect(data.dateRecolte).toBeNull()
  })

  it("traite '' comme un effacement", () => {
    const data = { dateSemis: '' }
    expect(normalizeCultureDateFields(data)).toBeNull()
    expect(data.dateSemis).toBeNull()
  })

  it('signale le champ fautif sans écrire de date invalide', () => {
    const data = { dateSemis: '2026-08-15', datePlantation: 'pas-une-date' }
    expect(normalizeCultureDateFields(data)).toBe('datePlantation')
    expect(data.datePlantation).toBe('pas-une-date')
  })
})
