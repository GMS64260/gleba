import { describe, expect, it } from 'vitest'
import { sansChamps } from './sans-champs'

describe('sansChamps', () => {
  it('retire les clés demandées sans toucher à l’objet d’origine', () => {
    const source = { userId: 'u1', createdAt: new Date(0), nom: 'Planche A', surface: 12 }
    const copie = sansChamps(source, 'userId', 'createdAt')
    expect(copie).toEqual({ nom: 'Planche A', surface: 12 })
    expect(source.userId).toBe('u1')
  })

  it('garde l’ordre des propriétés restantes, comme une déstructuration `...reste`', () => {
    const source = { iban: 'FR76', id: 'f1', bic: 'AGRI', contact: 'x', ribCle: '97' }
    const { iban: _i, bic: _b, ribCle: _r, ...attendu } = source
    void _i; void _b; void _r
    expect(Object.keys(sansChamps(source, 'iban', 'bic', 'ribCle'))).toEqual(Object.keys(attendu))
  })
})
