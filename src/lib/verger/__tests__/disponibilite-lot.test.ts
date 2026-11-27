import { describe, expect, it } from 'vitest'
import { indisponibiliteLotVerger, joursAvantPeremptionLot } from '../disponibilite-lot'

describe('joursAvantPeremptionLot (D109)', () => {
  const peremption = new Date('2026-11-26T00:00:00.000Z')

  it('le jour de la péremption est le dernier jour vendable, pas un lot périmé', () => {
    const matin = new Date('2026-11-26T09:00:00.000Z')
    expect(joursAvantPeremptionLot(peremption, matin)).toBe(0)
    expect(indisponibiliteLotVerger({ date: new Date('2026-11-01T00:00:00.000Z'), datePeremption: peremption }, matin)).toBeNull()
  })

  it('compte en jours civils, sans tronquer les heures', () => {
    expect(joursAvantPeremptionLot('2026-11-27T00:00:00.000Z', new Date('2026-11-26T09:00:00.000Z'))).toBe(1)
    expect(joursAvantPeremptionLot(peremption, new Date('2026-11-27T09:00:00.000Z'))).toBe(-1)
  })

  it('dit périmé exactement quand la règle de vente refuse le lot', () => {
    const lendemain = new Date('2026-11-27T09:00:00.000Z')
    expect(joursAvantPeremptionLot(peremption, lendemain) < 0).toBe(true)
    expect(indisponibiliteLotVerger({ date: new Date('2026-11-01T00:00:00.000Z'), datePeremption: peremption }, lendemain)).toBe('perime')
  })
})
