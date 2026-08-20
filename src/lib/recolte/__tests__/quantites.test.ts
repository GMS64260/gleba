/**
 * Ventilation des quantités de récolte par unité.
 *
 * Le défaut que ces tests interdisent : additionner des unités différentes, ou
 * ne garder que les kilos — ce qui faisait lire « 0 kg » à une ferme de fleurs
 * coupées ayant récolté des milliers de tiges (2026-08-20).
 */

import { describe, expect, it } from 'vitest'
import {
  ajouterQuantite,
  arrondirQuantites,
  contientHorsKg,
  formatQuantite,
  formatQuantiteParUnite,
  fusionnerQuantites,
  partKg,
  quantitesNonNulles,
} from '../quantites'

describe('ajouterQuantite', () => {
  it('cumule par unité, sans jamais les mélanger', () => {
    const acc = {}
    ajouterQuantite(acc, 'kg', 12)
    ajouterQuantite(acc, 'tige', 120)
    ajouterQuantite(acc, 'kg', 3)
    expect(acc).toEqual({ kg: 15, tige: 120 })
  })

  it('ignore zéro et les valeurs non finies (pas de clé fantôme)', () => {
    const acc = {}
    ajouterQuantite(acc, 'kg', 0)
    ajouterQuantite(acc, 'tige', Number.NaN)
    ajouterQuantite(acc, 'piece', Number.POSITIVE_INFINITY)
    expect(acc).toEqual({})
  })
})

describe('fusionnerQuantites', () => {
  it('somme plusieurs ventilations sans toucher aux sources', () => {
    const a = { kg: 10 }
    const b = { kg: 5, tige: 40 }
    expect(fusionnerQuantites(a, b, null, undefined)).toEqual({ kg: 15, tige: 40 })
    expect(a).toEqual({ kg: 10 })
  })
})

describe('arrondirQuantites', () => {
  it('arrondit les kilos au centième et les unités comptées à l’entier', () => {
    // « 359,4 tiges » n'est pas une précision, c'est une erreur de lecture.
    expect(arrondirQuantites({ kg: 10.799999999999999, tige: 359.4 })).toEqual({
      kg: 10.8,
      tige: 359,
    })
  })
})

describe('formatQuantite', () => {
  it('accorde le libellé au nombre', () => {
    expect(formatQuantite(1, 'tige')).toBe('1 tige')
    expect(formatQuantite(360, 'tige')).toBe('360 tiges')
    expect(formatQuantite(1, 'piece')).toBe('1 pièce')
    expect(formatQuantite(12, 'botte')).toBe('12 bottes')
    expect(formatQuantite(1, 'kg')).toBe('1 kg')
  })

  it('n’affiche pas de décimale sur une unité comptée', () => {
    expect(formatQuantite(12.5, 'kg')).toBe('12,5 kg')
    expect(formatQuantite(120.4, 'tige')).toBe('120 tiges')
  })
})

describe('formatQuantiteParUnite', () => {
  it('ventile avec un « + », qui dit que les termes ne se confondent pas', () => {
    expect(formatQuantiteParUnite({ kg: 12.5, tige: 360 })).toBe('12,5 kg + 360 tiges')
  })

  it('les kilos passent en premier, quel que soit l’ordre de saisie', () => {
    expect(formatQuantiteParUnite({ botte: 12, kg: 3 })).toBe('3 kg + 12 bottes')
  })

  it('une ventilation vide vaut 0 kg (et non un tiret)', () => {
    expect(formatQuantiteParUnite({})).toBe('0 kg')
  })

  it('n’affiche pas une unité dont l’arrondi tombe à zéro', () => {
    expect(formatQuantiteParUnite({ kg: 0.001, tige: 0.4 })).toBe('0 kg')
  })
})

describe('partKg et contientHorsKg', () => {
  it('partKg n’extrait QUE les kilos', () => {
    expect(partKg({ kg: 12, tige: 360 })).toBe(12)
    expect(partKg({ tige: 360 })).toBe(0)
  })

  it('contientHorsKg repère une production non pondérale', () => {
    expect(contientHorsKg({ kg: 12 })).toBe(false)
    expect(contientHorsKg({ kg: 12, tige: 360 })).toBe(true)
    expect(contientHorsKg({})).toBe(false)
  })

  it('quantitesNonNulles rend l’ordre d’affichage', () => {
    expect(quantitesNonNulles({ tige: 5, kg: 2 })).toEqual([
      { unite: 'kg', quantite: 2 },
      { unite: 'tige', quantite: 5 },
    ])
  })
})
