import { describe, expect, it } from 'vitest'
import { jourLocalISO } from '@/lib/jour-civil'
import { ancienneteImpayee } from './anciennete-impayees'

const GRAINE = 20261119
let etat = GRAINE
function entier(borne: number) {
  etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
  return etat % borne
}

const cas = Array.from({ length: 360 }, (_, index) => {
  const annee = 2020 + entier(16)
  // 80 dates couvrent explicitement les derniers dimanches de mars/octobre
  // et leurs voisins (changements d'heure Europe/Paris), le reste est réparti.
  const mois = index < 80 ? (index % 2 === 0 ? 2 : 9) : entier(12)
  const dernier = new Date(annee, mois + 1, 0, 12)
  const jour = index < 80 ? dernier.getDate() - dernier.getDay() + entier(5) - 2 : 1 + entier(28)
  return { index, date: new Date(annee, mois, jour, 12) }
})

describe(`Ancienneté civile — graine ${GRAINE}, ${cas.length} dates, TZ=${process.env.TZ}`, () => {
  it.each(cas)('conserve le jour stocké, ignore les heures et compte les jours voisins [$index]', ({ date }) => {
    const jour = jourLocalISO(date)
    const [annee, mois, numero] = [date.getFullYear(), date.getMonth(), date.getDate()]
    const stockee = `${jour}T00:00:00.000Z`
    for (const heure of [0, 1, 2, 3, 12, 23]) {
      const maintenant = new Date(annee, mois, numero, heure, 15)
      expect(ancienneteImpayee(jour, maintenant)).toBe(0)
      expect(ancienneteImpayee(stockee, maintenant)).toBe(0)
      // Un vrai instant du même jour, pas une copie du calcul sous test.
      for (const heurePiece of [0, 3, 12, 23]) {
        const piece = new Date(annee, mois, numero, heurePiece, 30)
        expect(ancienneteImpayee(piece.toISOString(), maintenant)).toBe(0)
      }
      expect(ancienneteImpayee(stockee, new Date(annee, mois, numero + 1, heure, 15))).toBe(1)
      expect(ancienneteImpayee(stockee, new Date(annee, mois, numero - 1, heure, 15))).toBe(-1)
    }
  })

  it('témoin : l’ancienne durée brute échoue entre deux jours séparés d’une heure', () => {
    const piece = new Date(2026, 2, 28, 23, 30)
    const maintenant = new Date(2026, 2, 29, 0, 30)
    const ancien = Math.floor((maintenant.getTime() - piece.getTime()) / 86_400_000)
    expect(ancien).toBe(0)
    expect(ancienneteImpayee(piece, maintenant)).toBe(1)
  })
})
