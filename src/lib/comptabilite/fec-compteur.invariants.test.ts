import { describe, expect, it } from 'vitest'
import { compterEcrituresFec } from './fec-compteur'

const GRAINE = 20261118
const ENSEMBLES = 350

type Ligne = { JournalCode: string; EcritureNum: string }
function ensembles(): Ligne[][] {
  let etat = GRAINE
  const suivant = (borne: number) => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
    return etat % borne
  }
  const journaux = ['VE', 'AC', 'BQ', 'CA', 'OD']
  return Array.from({ length: ENSEMBLES }, () => Array.from({ length: 1 + suivant(100) }, () => ({
    JournalCode: journaux[suivant(journaux.length)],
    EcritureNum: String(1 + suivant(20)).padStart(6, '0'),
  })))
}

describe(`Compteur FEC — graine ${GRAINE}, ${ENSEMBLES} ensembles par propriété`, () => {
  const jeux = ensembles()

  it('une permutation conserve le compte', () => {
    for (const lignes of jeux) {
      const permutees = lignes.filter((_, i) => i % 2 === 1).concat(lignes.filter((_, i) => i % 2 === 0).reverse())
      expect(compterEcrituresFec(permutees)).toBe(compterEcrituresFec(lignes))
    }
  })

  it('la duplication de chaque ligne conserve le compte', () => {
    for (const lignes of jeux) {
      expect(compterEcrituresFec(lignes.flatMap(l => [l, { ...l }]))).toBe(compterEcrituresFec(lignes))
    }
  })

  it('un nouveau couple ajoute exactement une écriture', () => {
    for (const lignes of jeux) {
      // Même numéro existant, nouveau journal : la clé doit inclure le journal.
      const nouvelle = { ...lignes[0], JournalCode: 'NOUVEAU' }
      expect(compterEcrituresFec([...lignes, nouvelle])).toBe(compterEcrituresFec(lignes) + 1)
      const nouveauNumero = { ...lignes[0], EcritureNum: '999999' }
      expect(compterEcrituresFec([...lignes, nouveauNumero])).toBe(compterEcrituresFec(lignes) + 1)
    }
  })
})
