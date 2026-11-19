import { describe, expect, it } from 'vitest'
import { estPreteARecolter, ordonnerPourSaisieRecolte } from './tri-recolte'

const JOUR = '2026-11-19'

describe('ordre de la saisie de récolte', () => {
  it('compte ±14 jours autour du jour demandé, bornes comprises', () => {
    expect(estPreteARecolter('2026-11-05', JOUR)).toBe(true)
    expect(estPreteARecolter('2026-12-03', JOUR)).toBe(true)
    expect(estPreteARecolter('2026-11-04', JOUR)).toBe(false)
    expect(estPreteARecolter('2026-12-04', JOUR)).toBe(false)
    expect(estPreteARecolter(null, JOUR)).toBe(false)
  })

  it('place les prêtes d’abord, puis les dates croissantes, les sans date en dernier', () => {
    const ordre = ordonnerPourSaisieRecolte(
      [
        { id: 1, dateRecolte: null },
        { id: 2, dateRecolte: '2027-03-01' },
        { id: 3, dateRecolte: '2026-11-25' },
        { id: 4, dateRecolte: '2026-08-01' },
        { id: 5, dateRecolte: new Date('2026-11-10T00:00:00.000Z') },
      ],
      JOUR,
    )
    expect(ordre.map((c) => c.id)).toEqual([5, 3, 4, 2, 1])
  })
})
