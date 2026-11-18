import type { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { lireContexteRegistre } from './contexte-registre'

const GRAINE = 20261118
function generateur() {
  let etat = GRAINE
  return (max: number) => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
    return etat % max
  }
}

describe(`contexte du registre immuable — graine ${GRAINE}`, () => {
  it('512 contextes figés, partiels ou vidés ne consultent jamais les fiches actuelles', async () => {
    const entier = generateur()
    const lecture = vi.fn(() => { throw new Error('Une fiche vivante ne doit pas être relue') })
    const db = { arbre: { findFirst: lecture }, culture: { findFirst: lecture }, planche: { findFirst: lecture }, parcelleGeo: { findFirst: lecture } } as unknown as Prisma.TransactionClient
    for (let n = 0; n < 512; n++) {
      const ligne = {
        date: new Date(Date.UTC(2020 + entier(7), entier(12), 1 + entier(28))),
        contexteFige: entier(2) === 0,
        cultureRegistre: [null, '', `Culture ${entier(1000)}`][entier(3)],
        localisationRegistre: [null, '', `Parcelle ${entier(1000)}`][entier(3)],
        conduiteBio: [null, false, true][entier(3)],
      }
      // Le seul état non figé est réservé au second invariant.
      if (ligne.cultureRegistre === null && ligne.localisationRegistre === null && ligne.conduiteBio === null) ligne.contexteFige = true
      const avant = structuredClone(ligne)
      expect(await lireContexteRegistre(db, `ferme-${entier(100)}`, ligne, { arbreId: entier(1000) + 1 })).toEqual({
        cultureRegistre: avant.cultureRegistre,
        localisationRegistre: avant.localisationRegistre,
        conduiteBio: avant.conduiteBio,
        contexteFige: true,
      })
      expect(ligne).toEqual(avant)
    }
    expect(lecture).not.toHaveBeenCalled()
  })

  it('256 lignes anciennes sans contexte gardent un repli explicitement non figé, borné au propriétaire', async () => {
    const entier = generateur()
    for (let n = 0; n < 256; n++) {
      const userId = `ferme-${entier(1000)}`
      const arbreId = entier(1000) + 1
      const nom = `Arbre ${entier(1000)}`
      const lecture = vi.fn(async () => ({ nom, espece: null, variete: null, gpsLat: null, gpsLng: null, parcelleGeo: null, zone: null }))
      const db = { arbre: { findFirst: lecture } } as unknown as Prisma.TransactionClient
      const contexte = await lireContexteRegistre(db, userId, { date: new Date('2020-01-01'), contexteFige: false }, { arbreId })
      expect(lecture).toHaveBeenCalledWith(expect.objectContaining({ where: { id: arbreId, userId } }))
      expect(contexte).toEqual({ cultureRegistre: nom, localisationRegistre: `Arbre ${nom}`, conduiteBio: null, contexteFige: false })
    }
  })
})
