import { describe, expect, it } from 'vitest'
import { jourMeteoISO, previsionDuJour } from './meteo-jour'

describe('jour des prévisions météo', () => {
  it.each([
    ['2026-07-20T22:30:00Z', '2026-07-21'],
    ['2026-11-13T23:30:00Z', '2026-11-14'],
    ['2026-10-25T00:30:00Z', '2026-10-25'],
    ['2026-10-25T01:30:00Z', '2026-10-25'],
  ])('date %s dans Europe/Paris : %s', (instant, jour) => {
    expect(jourMeteoISO(new Date(instant))).toBe(jour)
  })

  it('accepte le fuseau de la ferme et conserve une pluie nulle', () => {
    const reference = new Date('2026-07-20T22:30:00Z')
    const jours = [{ date: '2026-07-21', precipitation: 12 }, { date: '2026-07-20', precipitation: 0 }]
    expect(previsionDuJour(jours, reference, 'America/Martinique')).toBe(jours[1])
    expect(previsionDuJour(jours, reference)).toBe(jours[0])
    expect(previsionDuJour([], reference)).toBeUndefined()
  })
})
