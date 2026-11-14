import { describe, expect, it } from 'vitest'
import { dateSoinARenvoyer, dateSoinRetenue, jourSoin } from './date-soin'

const J = (iso: string) => new Date(iso)

// Ticket cmvnp6s3z (QA 2026-10-25).
// Les dates locales sont construites dans le fuseau réel du processus.
describe('date du soin : jour seul et heure réelle (ticket cmvnp6s3z)', () => {

  it('jourSoin : jour local d’une heure réelle, jour saisi d’une date sans heure', () => {
    expect(jourSoin(new Date(2026, 8, 24, 0, 30))).toBe('2026-09-24') // 24/09 00:30 local
    expect(jourSoin(J('2026-09-24T06:00:00Z'))).toBe('2026-09-24') // 24/09 08:00 Paris
    expect(jourSoin(J('2026-09-24T00:00:00Z'))).toBe('2026-09-24') // saisie « 2026-09-24 » du POST
  })

  it('même jour sans heure : date stockée inchangée, heure réelle gardée', () => {
    expect(dateSoinRetenue(J('2026-09-24T06:00:00Z'), '2026-09-24')).toEqual(J('2026-09-24T06:00:00Z'))
    expect(dateSoinRetenue(new Date(2026, 8, 24, 0, 30), '2026-09-24')).toEqual(new Date(2026, 8, 24, 0, 30))
    expect(dateSoinRetenue(J('2026-09-24T00:00:00Z'), ' 2026-09-24 ')).toEqual(J('2026-09-24T00:00:00Z'))
  })

  it('autre jour : même heure murale locale, changement d’heure compris', () => {
    // 24/09 00:30 local → 26/09 00:30 local.
    expect(dateSoinRetenue(new Date(2026, 8, 24, 0, 30), '2026-09-26')).toEqual(new Date(2026, 8, 26, 0, 30))
    // Même heure murale entre été et hiver (avec changement d'offset à Paris).
    expect(dateSoinRetenue(new Date(2026, 8, 24, 8), '2026-10-30')).toEqual(new Date(2026, 9, 30, 8))
  })

  it('autre jour, date stockée sans heure : minuit UTC du jour saisi, comme le POST', () => {
    expect(dateSoinRetenue(J('2026-07-21T00:00:00Z'), '2026-07-22')).toEqual(J('2026-07-22T00:00:00Z'))
    expect(dateSoinRetenue(J('2026-11-05T00:00:00Z'), '2026-09-24')).toEqual(J('2026-09-24T00:00:00Z'))
  })

  it('une saisie horodatée passe telle quelle, même à 00:00:00Z ; un jour impossible est invalide', () => {
    expect(dateSoinRetenue(J('2026-09-24T06:00:00Z'), '2026-09-24T00:00:00.000Z')).toEqual(J('2026-09-24T00:00:00Z'))
    expect(dateSoinRetenue(J('2026-09-24T06:00:00Z'), J('2026-09-24T00:00:00Z'))).toEqual(J('2026-09-24T00:00:00Z'))
    expect(Number.isNaN(dateSoinRetenue(J('2026-09-24T06:00:00Z'), '2026-02-31').getTime())).toBe(true)
    expect(Number.isNaN(dateSoinRetenue(J('2026-09-24T00:00:00Z'), '2026-02-31').getTime())).toBe(true)
  })

  it('le dialogue renvoie la date stockée intacte si le jour n’est pas touché', () => {
    const stockee = new Date(2026, 8, 24, 0, 30).toISOString()
    expect(dateSoinARenvoyer('2026-09-24', stockee)).toBe(stockee)
    expect(dateSoinARenvoyer('2026-09-25', stockee)).toBe('2026-09-25')
    expect(dateSoinARenvoyer('2026-09-24', null)).toBe('2026-09-24')
  })
})
