import { describe, expect, it } from 'vitest'
import { datePrevueEtapeType } from './essences-forestieres'

describe('datePrevueEtapeType (D185)', () => {
  const plantation = new Date(2026, 11, 31)

  it('recale au 15 février suivant un élagage de formation qui tombe hors de janvier–mars', () => {
    const date = datePrevueEtapeType(plantation, { type: 'elagage_formation', offsetJours: 3650 })
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2037, 2, 15])
  })

  it('garde la date brute en fenêtre hivernale et pour les autres étapes', () => {
    const fevrier = datePrevueEtapeType(new Date(2026, 0, 10), { type: 'elagage_formation', offsetJours: 30 })
    expect([fevrier.getMonth() + 1, fevrier.getDate()]).toEqual([2, 9])
    const regarni = datePrevueEtapeType(plantation, { type: 'regarnissage', offsetJours: 365 })
    expect([regarni.getFullYear(), regarni.getMonth() + 1, regarni.getDate()]).toEqual([2027, 12, 31])
  })
})
