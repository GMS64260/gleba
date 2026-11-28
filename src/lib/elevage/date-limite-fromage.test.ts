import { describe, expect, it } from 'vitest'
import { refusDateLimiteFromage } from './date-limite-fromage'

const lot = { dateFabrication: new Date('2026-11-20T00:00:00Z'), dlc: null, dluo: new Date('2026-11-10T00:00:00Z') }

describe('date limite d’un lot de fromage à la modification (D247)', () => {
  it('refuse une DLC antérieure à la fabrication', () => {
    expect(refusDateLimiteFromage(lot, { dlc: new Date('2026-11-19T00:00:00Z') })).toMatchObject({ champ: 'dlc', error: expect.stringContaining('20/11/2026') })
  })
  it('accepte une date limite le jour de la fabrication ou après', () => {
    expect(refusDateLimiteFromage(lot, { dlc: new Date('2026-11-20T00:00:00Z'), dluo: new Date('2026-12-20T00:00:00Z') })).toBeNull()
  })
  it('ne contrôle pas une date inchangée, même déjà incohérente, ni un retrait', () => {
    expect(refusDateLimiteFromage(lot, { dluo: new Date('2026-11-10T00:00:00Z') })).toBeNull()
    expect(refusDateLimiteFromage(lot, { dluo: null })).toBeNull()
    expect(refusDateLimiteFromage(lot, {})).toBeNull()
  })
})
