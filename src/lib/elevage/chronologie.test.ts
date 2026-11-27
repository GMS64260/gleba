import { describe, expect, it } from 'vitest'
import { debutPresence, motifArriveeAvantNaissance, motifSortieAvantEntree, refuserSortieAvantEntree } from './chronologie'

const libelles = { evenement: 'Abattage', sujet: 'du lot' }

describe('chronologie du cheptel (D97)', () => {
  it('refuse une sortie datée avant l’arrivée du lot', () => {
    const motif = motifSortieAvantEntree('2026-11-25', { dateArrivee: new Date('2026-11-26T00:00:00Z') }, libelles)
    expect(motif).toContain('25/11/2026')
    expect(motif).toContain("l'arrivée du lot (26/11/2026)")
    expect(() => refuserSortieAvantEntree('2026-11-25', { dateArrivee: '2026-11-26' }, libelles)).toThrow(/précède/)
  })

  it('accepte le jour même de l’arrivée, quelle que soit l’heure', () => {
    expect(motifSortieAvantEntree(new Date('2026-11-26T00:00:00Z'), { dateArrivee: new Date('2026-11-26T00:00:00Z') }, libelles)).toBeNull()
    expect(motifSortieAvantEntree('2026-11-27', { dateArrivee: '2026-11-26' }, libelles)).toBeNull()
  })

  it('se rabat sur la naissance, et ne contrôle rien sans date d’entrée', () => {
    expect(debutPresence({ dateArrivee: null, dateNaissance: '2026-03-01' })).toBe('2026-03-01')
    expect(motifSortieAvantEntree('2026-02-01', { dateNaissance: '2026-03-01' }, { evenement: 'Abattage', sujet: "de l'animal" })).toContain('la naissance')
    expect(motifSortieAvantEntree('2020-01-01', {}, libelles)).toBeNull()
  })
})

describe('arrivée et naissance d’un animal (D220)', () => {
  it('refuse une arrivée datée avant la naissance', () => {
    const motif = motifArriveeAvantNaissance({ dateNaissance: '2026-11-20', dateArrivee: new Date('2026-11-19T00:00:00Z') })
    expect(motif).toContain('19/11/2026')
    expect(motif).toContain('naissance de l\'animal (20/11/2026)')
  })

  it('accepte le jour de la naissance et ne contrôle rien sans les deux dates', () => {
    expect(motifArriveeAvantNaissance({ dateNaissance: '2026-11-20', dateArrivee: '2026-11-20' })).toBeNull()
    expect(motifArriveeAvantNaissance({ dateNaissance: null, dateArrivee: '2026-11-19' })).toBeNull()
    expect(motifArriveeAvantNaissance({ dateNaissance: '2026-11-20', dateArrivee: null })).toBeNull()
  })
})
