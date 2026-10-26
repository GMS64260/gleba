import { describe, it, expect } from 'vitest'
import { finJourLivraison, livraisonFuture } from './dates-stock'

describe('jour civil des sorties commerciales', () => {
  it.each([
    ['2026-10-27T12:00:00Z', '2026-10-26T23:15:00Z'],
    ['2026-07-27T12:00:00Z', '2026-07-26T22:15:00Z'],
  ])('autorise aujourd’hui après minuit Paris, avant minuit UTC (%s)', (livraison, maintenant) => {
    expect(livraisonFuture(new Date(livraison), new Date(maintenant))).toBe(false)
  })
  it('refuse demain et accepte hier', () => {
    const maintenant = new Date('2026-10-26T23:15:00Z')
    expect(livraisonFuture(new Date('2026-10-28T12:00:00Z'), maintenant)).toBe(true)
    expect(livraisonFuture(new Date('2026-10-26T12:00:00Z'), maintenant)).toBe(false)
  })
  it.each([
    ['2026-10-27', '2026-10-27T22:59:59.999Z'],
    ['2026-07-27', '2026-07-27T21:59:59.999Z'],
    ['2026-03-29', '2026-03-29T21:59:59.999Z'],
    ['2026-10-25', '2026-10-25T22:59:59.999Z'],
  ])('borne les lots à la fin du jour Paris, transition d’heure comprise (%s)', (jour, fin) => {
    expect(finJourLivraison(new Date(`${jour}T12:00:00Z`)).toISOString()).toBe(fin)
  })
})
