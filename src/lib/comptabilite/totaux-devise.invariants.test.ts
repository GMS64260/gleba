import { describe, expect, it } from 'vitest'
import type { Devise } from '@/lib/territoires'
import { deviseCommuneDesSeries, margeParDevise, sommerParDevise, soustraireParDevise, totalSiUneDevise } from './totaux-devise'
import { computeYearDiff } from './year-diff'

const GRAINE = 20261117
const devises: Array<Devise | null> = ['EUR', 'XPF', null]
function generateur() {
  let etat = GRAINE
  return (borne: number) => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
    return etat % borne
  }
}

describe(`Invariants des montants par devise — graine ${GRAINE}`, () => {
  it('500 jeux : chaque centime et chaque avoir restent dans leur devise, indépendamment de l’ordre', () => {
    const suivant = generateur()
    for (let essai = 0; essai < 500; essai++) {
      const lignes = Array.from({ length: 3 + suivant(60) }, () => ({
        monnaie: devises[suivant(devises.length)], centimes: suivant(200001) - 100000,
      }))
      const total = (liste: typeof lignes) => sommerParDevise(liste, l => l.monnaie, l => l.centimes / 100, 'XPF')
      const groupes = total(lignes)
      expect(total([...lignes].reverse()), `essai ${essai}`).toEqual(groupes)
      for (const groupe of groupes) {
        const presentes = lignes.filter(l => l.monnaie === groupe.monnaie)
        expect(groupe.total).toBe(presentes.reduce((s, l) => s + l.centimes, 0) / 100)
        expect(groupe.count).toBe(presentes.length)
      }
      expect(totalSiUneDevise(groupes)).toBe(groupes.length === 1 ? groupes[0].total : null)
    }
  })

  it('500 jeux : revenus moins charges et annulation se calculent séparément pour chaque devise', () => {
    const suivant = generateur()
    for (let essai = 0; essai < 500; essai++) {
      const recettes = devises.map(monnaie => ({ monnaie, total: suivant(100001) / 100, count: 1 }))
      const charges = devises.map(monnaie => ({ monnaie, total: suivant(100001) / 100, count: 1 }))
      const resultat = soustraireParDevise(recettes, charges)
      expect(resultat.map(g => g.monnaie)).toEqual(devises)
      resultat.forEach((g, i) => expect(Math.round(g.total * 100)).toBe(Math.round(recettes[i].total * 100) - Math.round(charges[i].total * 100)))
      expect(soustraireParDevise(recettes, recettes).map(g => g.total)).toEqual([0, 0, 0])
      expect(totalSiUneDevise(resultat)).toBeNull()
      expect(margeParDevise(recettes, charges)).toBeNull()
    }
  })

  it('500 comparatifs : aucune évolution entre devises différentes ou inconnues, même à solde nul', () => {
    const suivant = generateur()
    for (let essai = 0; essai < 500; essai++) {
      const monnaie = devises[suivant(3)]
      const precedente = devises[suivant(3)]
      const actuel = suivant(10000)
      const ancien = 1 + suivant(10000)
      const comparaison = computeYearDiff({
        revenus: actuel, revenusAnneePrecedente: ancien,
        revenusParDevise: [{ monnaie, total: actuel, count: 1 }],
        revenusAnneePrecedenteParDevise: [{ monnaie: precedente, total: ancien, count: 1 }],
      })
      if (monnaie === null || precedente === null || monnaie !== precedente) {
        expect(comparaison.state).toBe('devises-differentes')
        expect(comparaison.percent).toBe(0)
        expect(margeParDevise([{ monnaie, total: actuel, count: 1 }], [{ monnaie: precedente, total: ancien, count: 1 }])).toBeNull()
      } else expect(comparaison.state).toBe('compare')
    }
  })

  it('une série en devise inconnue ne devient jamais un graphique dans la devise courante', () => {
    for (const deviseCourante of devises) {
      for (const total of [0, 1, -1, 987.65]) {
        expect(deviseCommuneDesSeries([{ valeur: total, parDevise: [{ monnaie: null, total, count: 1 }] }], deviseCourante)).toBeNull()
      }
    }
  })
})
