import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dateSoinARenvoyer, dateSoinRetenue, jourSoin } from './date-soin'

const J = (iso: string) => new Date(iso)

// Ticket cmvnp6s3z (QA 2026-10-25). Fuseau du conteneur de production
// (docker-compose : TZ Europe/Paris).
describe('date du soin : jour seul et heure réelle (ticket cmvnp6s3z)', () => {
  const tzAvant = process.env.TZ
  beforeAll(() => { process.env.TZ = 'Europe/Paris' })
  afterAll(() => {
    if (tzAvant === undefined) delete process.env.TZ
    else process.env.TZ = tzAvant
  })

  it('jourSoin : jour local d’une heure réelle, jour saisi d’une date sans heure', () => {
    expect(jourSoin(J('2026-09-23T22:30:00Z'))).toBe('2026-09-24') // 24/09 00:30 Paris
    expect(jourSoin(J('2026-09-24T06:00:00Z'))).toBe('2026-09-24') // 24/09 08:00 Paris
    expect(jourSoin(J('2026-09-24T00:00:00Z'))).toBe('2026-09-24') // saisie « 2026-09-24 » du POST
  })

  it('même jour sans heure : date stockée inchangée, heure réelle gardée', () => {
    expect(dateSoinRetenue(J('2026-09-24T06:00:00Z'), '2026-09-24')).toEqual(J('2026-09-24T06:00:00Z'))
    expect(dateSoinRetenue(J('2026-09-23T22:30:00Z'), '2026-09-24')).toEqual(J('2026-09-23T22:30:00Z'))
    expect(dateSoinRetenue(J('2026-09-24T00:00:00Z'), ' 2026-09-24 ')).toEqual(J('2026-09-24T00:00:00Z'))
  })

  it('autre jour : même heure murale locale, changement d’heure compris', () => {
    // 24/09 00:30 Paris → 26/09 00:30 Paris.
    expect(dateSoinRetenue(J('2026-09-23T22:30:00Z'), '2026-09-26')).toEqual(J('2026-09-25T22:30:00Z'))
    // 08:00 heure d'été → 08:00 heure d'hiver (07:00 UTC).
    expect(dateSoinRetenue(J('2026-09-24T06:00:00Z'), '2026-10-30')).toEqual(J('2026-10-30T07:00:00Z'))
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
    expect(dateSoinARenvoyer('2026-09-24', '2026-09-23T22:30:00.000Z')).toBe('2026-09-23T22:30:00.000Z')
    expect(dateSoinARenvoyer('2026-09-25', '2026-09-23T22:30:00.000Z')).toBe('2026-09-25')
    expect(dateSoinARenvoyer('2026-09-24', null)).toBe('2026-09-24')
  })
})
