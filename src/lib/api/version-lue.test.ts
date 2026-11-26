import { describe, expect, it } from 'vitest'
import { CODE_MODIFIE_AILLEURS, reponseModifieAilleurs, versionPerimee } from './version-lue'

const enBase = new Date('2026-11-26T08:00:00.123Z')

describe('verrou optimiste des fiches (D74)', () => {
  it('laisse passer un appelant qui n’envoie pas de version', () => {
    expect(versionPerimee(undefined, enBase)).toBe(false)
    expect(versionPerimee(null, enBase)).toBe(false)
    expect(versionPerimee('', enBase)).toBe(false)
  })

  it('accepte la version lue quand la fiche n’a pas changé', () => {
    expect(versionPerimee('2026-11-26T08:00:00.123Z', enBase)).toBe(false)
    expect(versionPerimee(new Date(enBase), enBase)).toBe(false)
  })

  it('refuse une version antérieure, ou illisible', () => {
    expect(versionPerimee('2026-11-26T07:59:00.000Z', enBase)).toBe(true)
    expect(versionPerimee('pas une date', enBase)).toBe(true)
  })

  it('répond 409 avec le code commun et la version actuelle', async () => {
    const reponse = reponseModifieAilleurs('Cette culture', enBase)
    expect(reponse.status).toBe(409)
    expect(await reponse.json()).toMatchObject({ code: CODE_MODIFIE_AILLEURS, versionActuelle: '2026-11-26T08:00:00.123Z' })
  })
})
