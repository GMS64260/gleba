import { describe, expect, it } from 'vitest'
import { enCentimes, lireMontant, soldeReglement } from '../monnaie'
describe('règlements au centime', () => {
  it.each([
    ['30,03', 3003],
    ['70.07', 7007],
    ['1 000,10', 100010],
    ['-12,34', -1234],
    [0.1, 10],
  ])('lit %s sans décimale binaire', (texte, cents) => expect(lireMontant(texte)).toBe(cents))
  it.each(['', '1,001', '1e3', 'NaN', 'Infinity', '1,2,3'])('refuse un montant ambigu : %s', (s) =>
    expect(() => lireMontant(s)).toThrow(),
  )
  it('solde exactement une facture en deux versements', () => {
    const total = enCentimes(100.1),
      premier = lireMontant('30,03'),
      deuxieme = lireMontant('70,07')
    expect(soldeReglement(total, premier)).toMatchObject({
      montantRegle: 30.03,
      resteAPayer: 70.07,
      statut: 'partiel',
    })
    expect(soldeReglement(total, premier + deuxieme)).toMatchObject({
      resteAPayer: 0,
      statut: 'regle',
    })
  })
  it('distingue le payé historique sans inventer un versement détaillé', () => {
    expect(soldeReglement(10000, 0, true, false)).toMatchObject({
      detaille: false,
      montantRegle: 100,
      resteAPayer: 0,
    })
    expect(soldeReglement(10000, 3000, true, true)).toMatchObject({
      detaille: true,
      montantRegle: 30,
      resteAPayer: 70,
    })
  })
  it('conserve un trop-perçu après avoir et un remboursement partiel', () =>
    expect(soldeReglement(5000, 7000)).toMatchObject({ resteAPayer: 0, tropPercu: 20 }))
})
