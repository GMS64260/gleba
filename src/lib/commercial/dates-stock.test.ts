import { describe, it, expect } from 'vitest'
import { finJourLivraison, livraisonFuture, dateEffetStockCommercial } from './dates-stock'

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

describe('effet des journaux sur le comptage manuel', () => {
  it('un ancien journal daté à midi mais créé avant le comptage ne ressort pas après celui-ci', () => {
    const effet = dateEffetStockCommercial({ date: new Date('2026-10-26T12:00Z'), createdAt: new Date('2026-10-26T09:00Z') })
    expect(effet.toISOString()).toBe('2026-10-26T09:00:00.000Z')
    expect(effet > new Date('2026-10-26T10:00Z')).toBe(false)
  })
  it('un journal du jour créé après un comptage reste une sortie après le comptage, même si midi est passé', () => {
    const effet = dateEffetStockCommercial({ date: new Date('2026-10-26T12:00Z'), createdAt: new Date('2026-10-26T16:00Z') })
    expect(effet > new Date('2026-10-26T15:00Z')).toBe(true)
  })
  it('une livraison historique garde son effet avant le comptage malgré une saisie tardive', () => {
    const effet = dateEffetStockCommercial({ date: new Date('2026-10-25T12:00Z'), createdAt: new Date('2026-10-27T09:00Z') })
    expect(effet.toISOString()).toBe('2026-10-25T12:00:00.000Z')
  })
})
