import { describe, expect, it } from 'vitest'

import { TAILLE_PAGE_MAX, lireAnneeFiltre, lireParametresListe } from '../pagination-liste'

const options = {
  taillePageDefaut: 50,
  trisPermis: ['id', 'annee', 'dateSemis'] as const,
  triDefaut: 'id' as const,
  ordreDefaut: 'desc' as const,
}
const lire = (requete: string) => lireParametresListe(new URLSearchParams(requete), options)

describe('lireParametresListe', () => {
  it('rend les défauts de la liste sans paramètre', () => {
    expect(lire('')).toEqual({ page: 1, pageSize: 50, skip: 0, sortBy: 'id', sortOrder: 'desc' })
  })

  it('lit une page, une taille et un tri valides', () => {
    expect(lire('page=3&pageSize=20&sortBy=annee&sortOrder=asc')).toEqual({
      page: 3,
      pageSize: 20,
      skip: 40,
      sortBy: 'annee',
      sortOrder: 'asc',
    })
  })

  it("retombe sur les défauts pour une valeur inexploitable, au lieu d'une erreur", () => {
    for (const requete of ['page=0', 'page=-2', 'page=abc', 'page=1.5', 'page=']) {
      expect(lire(requete)).toMatchObject({ page: 1, skip: 0 })
    }
    for (const requete of ['pageSize=abc', 'pageSize=0', 'pageSize=-5', 'pageSize=12px']) {
      expect(lire(requete).pageSize).toBe(50)
    }
  })

  it('plafonne la taille de page', () => {
    expect(lire('pageSize=999999').pageSize).toBe(TAILLE_PAGE_MAX)
  })

  it("ignore un tri qui n'est pas une colonne permise, et un ordre inconnu", () => {
    expect(lire('sortBy=motDePasse&sortOrder=drop')).toMatchObject({ sortBy: 'id', sortOrder: 'desc' })
    expect(lire('sortBy=__proto__').sortBy).toBe('id')
  })
})

describe('lireAnneeFiltre', () => {
  it("lit une année, ignore le reste", () => {
    expect(lireAnneeFiltre('2026')).toBe(2026)
    expect(lireAnneeFiltre(null)).toBeNull()
    expect(lireAnneeFiltre('abc')).toBeNull()
    expect(lireAnneeFiltre('20260')).toBeNull()
  })
})
