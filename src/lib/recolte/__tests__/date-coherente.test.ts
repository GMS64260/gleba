import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { refusPeremptionAvantRecolte, refusRecolteAvantDebut } from '../date-coherente'

// Fuseau de la production : la règle compare des journées civiles de Paris.
beforeAll(() => { vi.stubEnv('TZ', 'Europe/Paris') })
afterAll(() => { vi.unstubAllEnvs() })

/**
 * QA cmv2r19al : une récolte datée avant la plantation (prévue le 21/11) était
 * acceptée le 10/10. Culture au format de la base (minuit de Paris, en UTC) ;
 * dates de récolte construites en heure locale, fuseau de Paris imposé.
 */
const ZINNIA = {
  id: 1174,
  // Minuit de Paris, comme en base (construit avant le changement de fuseau).
  dateSemis: new Date('2026-10-09T22:00:00.000Z'),
  datePlantation: new Date('2026-11-20T23:00:00.000Z'),
  semisFait: false,
  plantationFaite: false,
}

describe('refusRecolteAvantDebut', () => {
  it('refuse une récolte antérieure à la plantation prévue, et dit quoi corriger', () => {
    const refus = refusRecolteAvantDebut(ZINNIA, new Date(2026, 9, 10, 14, 0))
    expect(refus).toBe(
      'Date de récolte refusée : la plantation de la culture #1174 est prévue le 21/11/2026, après le 10/10/2026. '
      + "Une récolte ne peut pas précéder la plantation. Si elle a déjà eu lieu, corrigez d'abord sa date sur la fiche de la culture.",
    )
  })

  it('accepte une récolte le jour même de la plantation, quelle que soit l’heure', () => {
    expect(refusRecolteAvantDebut(ZINNIA, new Date(2026, 10, 21, 0, 0))).toBeNull()
    expect(refusRecolteAvantDebut(ZINNIA, new Date(2026, 10, 21, 23, 59))).toBeNull()
  })

  it('accepte une récolte après la plantation', () => {
    expect(refusRecolteAvantDebut(ZINNIA, new Date(2027, 0, 16, 9, 0))).toBeNull()
  })

  it('compare des journées civiles locales : la veille à 23:59 reste avant la plantation', () => {
    const plantationMinuitLocal = new Date(2026, 10, 21, 0, 0)
    const recolteLe20 = new Date(2026, 10, 20, 23, 59)
    expect(refusRecolteAvantDebut({ ...ZINNIA, datePlantation: plantationMinuitLocal }, recolteLe20)).not.toBeNull()
  })

  it('formats réels : écran à minuit UTC contre plantation stockée à minuit de Paris', () => {
    // Plantation du 21/11 stockée 2026-11-20T23:00Z ; l'écran envoie
    // new Date("2026-11-20") (minuit UTC) pour une récolte du 20/11.
    const culture = { ...ZINNIA, datePlantation: new Date('2026-11-20T23:00:00.000Z') }
    expect(refusRecolteAvantDebut(culture, new Date('2026-11-20'))).toContain('prévue le 21/11/2026, après le 20/11/2026')
    expect(refusRecolteAvantDebut(culture, new Date('2026-11-21'))).toBeNull()
  })

  it('sans plantation, le semis fait foi ; une étape faite est dite faite, sans conseil', () => {
    const refus = refusRecolteAvantDebut(
      { id: 12, dateSemis: new Date(2026, 8, 1), datePlantation: null, semisFait: true, plantationFaite: false },
      new Date(2026, 7, 30),
    )
    expect(refus).toBe(
      'Date de récolte refusée : la culture #12 a été semée le 01/09/2026, après le 30/08/2026. Une récolte ne peut pas précéder le semis.',
    )
  })

  it('semis prévu : accord au masculin', () => {
    const refus = refusRecolteAvantDebut(
      { id: 13, dateSemis: new Date(2026, 8, 1), datePlantation: null, semisFait: false, plantationFaite: false },
      new Date(2026, 7, 30),
    )
    expect(refus).toContain('le semis de la culture #13 est prévu le 01/09/2026')
    expect(refus).toContain("S'il a déjà eu lieu")
  })

  it('culture sans date de début : rien à opposer', () => {
    expect(
      refusRecolteAvantDebut(
        { id: 14, dateSemis: null, datePlantation: null, semisFait: false, plantationFaite: false },
        new Date(2026, 0, 1),
      ),
    ).toBeNull()
  })
})

// Défaut D52 : une récolte du 22/11 périmant le 23/11 se redatait au 24/11.
describe('refusPeremptionAvantRecolte', () => {
  const peremption = new Date('2026-11-23T00:00:00.000Z')

  it('refuse une récolte datée après sa péremption, avec les deux dates', () => {
    expect(refusPeremptionAvantRecolte(new Date('2026-11-24T00:00:00.000Z'), peremption)).toBe(
      "La péremption (23/11/2026) précède la récolte (24/11/2026). Une récolte se date au plus tard le jour de sa péremption : corrigez l'une des deux dates.",
    )
  })

  it('accepte une péremption le jour même, quelle que soit l’heure de la récolte', () => {
    expect(refusPeremptionAvantRecolte(new Date('2026-11-23T00:00:00.000Z'), peremption)).toBeNull()
    // Récolte saisie à 17 h 30 à Paris le 23/11 : même jour civil.
    expect(refusPeremptionAvantRecolte(new Date('2026-11-23T16:30:00.000Z'), peremption)).toBeNull()
    // 23 h 30 UTC le 23/11, c'est 00 h 30 à Paris le 24 : un jour trop tard.
    expect(refusPeremptionAvantRecolte(new Date('2026-11-23T23:30:00.000Z'), peremption)).not.toBeNull()
  })

  it('accepte une péremption postérieure ou absente', () => {
    expect(refusPeremptionAvantRecolte(new Date('2026-11-22T00:00:00.000Z'), peremption)).toBeNull()
    expect(refusPeremptionAvantRecolte(new Date('2026-11-22T00:00:00.000Z'), null)).toBeNull()
    expect(refusPeremptionAvantRecolte(new Date('2026-11-22T00:00:00.000Z'), undefined)).toBeNull()
  })
})
