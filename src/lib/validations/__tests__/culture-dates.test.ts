import { describe, expect, it } from 'vitest'
import {
  cultureFormSchema,
  cultureUpdateFormSchema,
  normalizeCultureDateFields,
} from '../culture'

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

// QA cmsfxvbab — la chronologie n'était vérifiée que par l'API : le refus
// arrivait en toast éphémère, formulaire vidé, et l'utilisateur concluait à un
// échec silencieux. Le schéma formulaire la refuse avant l'envoi.
describe('cultureFormSchema — chronologie', () => {
  const base = {
    especeId: 'Pourpier',
    semisFait: false,
    plantationFaite: false,
    recolteFaite: false,
  }

  it('refuse une récolte antérieure au semis, sur le champ récolte', () => {
    const r = cultureFormSchema.safeParse({
      ...base,
      dateSemis: '2026-08-05',
      dateRecolte: '2026-04-20',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path.join('.'))).toContain('dateRecolte')
    }
  })

  it('refuse une plantation antérieure au semis', () => {
    const r = cultureFormSchema.safeParse({
      ...base,
      dateSemis: '2026-05-10',
      datePlantation: '2026-04-01',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path.join('.'))).toContain('datePlantation')
    }
  })

  it('accepte un cycle chronologique complet', () => {
    const r = cultureFormSchema.safeParse({
      ...base,
      dateSemis: '2026-03-02',
      datePlantation: '2026-04-27',
      dateRecolte: '2026-08-17',
    })
    expect(r.success).toBe(true)
  })

  it('accepte les dates absentes ou partielles', () => {
    expect(cultureFormSchema.safeParse({ ...base }).success).toBe(true)
    expect(
      cultureFormSchema.safeParse({ ...base, dateRecolte: '2026-04-20' }).success
    ).toBe(true)
  })

  it('applique la même règle au schéma d’édition partiel', () => {
    expect(
      cultureUpdateFormSchema.safeParse({
        dateSemis: '2026-08-05',
        dateRecolte: '2026-04-20',
      }).success
    ).toBe(false)
    expect(cultureUpdateFormSchema.safeParse({ notes: 'ok' }).success).toBe(true)
  })
})
