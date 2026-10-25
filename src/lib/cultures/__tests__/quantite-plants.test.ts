/**
 * Ticket QA cmvnpkkhp (2026-10-25) — une seule règle pour le nombre de plants
 * d'une culture : écrans (assistant « Semer », formulaires, dialogue du plan),
 * Planification > Plants, routes de création et de modification, outils de
 * l'assistant.
 */
import { describe, expect, it } from 'vitest'
import {
  nbPlantsCulture,
  quantiteCultureACreer,
  quantiteCultureApresModification,
} from '../quantite-plants'

describe('nbPlantsCulture', () => {
  // [longueur (m), rangs, espacement (cm), plants] : rangs × ⌊cm ÷ espacement⌋,
  // attendus calculés en entiers. Les cas en flottant piégeux sont ceux où
  // l'une des anciennes formules perdait un plant.
  const grille: Array<[number, number, number, number]> = [
    [16, 3, 30, 159], // laitue du ticket : 3 × ⌊53,33⌋
    [2.3, 1, 10, 23], // 2.3 * 100 / 10 = 22,999… (formulaires : 22)
    [0.3, 1, 10, 3], // 0.3 / 0.1 = 2,999… (« Semer » : 2)
    [1.15, 2, 5, 46], // 2 × 23 (formulaires : 44)
    [2.05, 1, 5, 41],
    [2.03, 1, 7, 29],
    [0.57, 1, 57, 1],
    [0.7, 1, 7, 10],
    [25, 2, 50, 100],
    [10, 1, 33, 30],
    [0.2, 3, 30, 0], // la longueur ne loge aucun plant
  ]

  it.each(grille)('%s m, %s rang(s) à %s cm → %s plants', (longueur, nbRangs, espacement, attendu) => {
    expect(nbPlantsCulture(longueur, nbRangs, espacement)).toBe(attendu)
  })

  it('rend null quand une donnée manque ou est invalide', () => {
    expect(nbPlantsCulture(null, 3, 30)).toBeNull()
    expect(nbPlantsCulture(16, undefined, 30)).toBeNull()
    expect(nbPlantsCulture(16, 3, 0)).toBeNull()
    expect(nbPlantsCulture(16, 3, -5)).toBeNull()
    expect(nbPlantsCulture(Number.NaN, 3, 30)).toBeNull()
  })
})

describe('quantiteCultureACreer', () => {
  it('déduit la quantité absente des rangs, de la longueur et de l’espacement', () => {
    expect(quantiteCultureACreer({ nbRangs: 3, longueur: 16, espacement: 30 })).toBe(159)
    expect(quantiteCultureACreer({ quantite: null, nbRangs: 3, longueur: 16, espacement: 30 })).toBe(159)
  })

  it('0 plant vaut absence : déduite, sinon null (jamais 0 en base)', () => {
    expect(quantiteCultureACreer({ quantite: 0, nbRangs: 3, longueur: 16, espacement: 30 })).toBe(159)
    expect(quantiteCultureACreer({ quantite: 0, nbRangs: 3, longueur: 0.2, espacement: 30 })).toBeNull()
  })

  it('garde la quantité envoyée, même différente du calcul', () => {
    expect(quantiteCultureACreer({ quantite: 150, nbRangs: 3, longueur: 16, espacement: 30 })).toBe(150)
  })

  it("n'invente rien sans paramètres complets ni pour moins d'un plant", () => {
    expect(quantiteCultureACreer({ nbRangs: 3, longueur: null, espacement: 30 })).toBeNull()
    expect(quantiteCultureACreer({ nbRangs: 3, longueur: 0.2, espacement: 30 })).toBeNull()
  })
})

describe('quantiteCultureApresModification', () => {
  const nee = { quantite: null, nbRangs: 3, longueur: 16, espacement: 30 }

  it('formulaire d’édition : quantité renvoyée vide sur une culture née sans elle → 159', () => {
    expect(quantiteCultureApresModification(nee, { quantite: null, nbRangs: 3, longueur: 16, espacement: 30 })).toBe(159)
  })

  it('quantité renvoyée à 0 : déduite, sinon null', () => {
    expect(quantiteCultureApresModification(nee, { quantite: 0 })).toBe(159)
    expect(quantiteCultureApresModification(nee, { quantite: 0, longueur: 0.2 })).toBeNull()
  })

  it('une quantité envoyée fait foi', () => {
    expect(quantiteCultureApresModification(nee, { quantite: 140 })).toBeUndefined()
  })

  it('paramètres modifiés sans quantité : recalcul si la quantité était automatique', () => {
    const auto = { ...nee, quantite: 159 }
    expect(quantiteCultureApresModification(auto, { nbRangs: 2 })).toBe(106)
    // Paramètres devenus incomplets : la quantité automatique s'efface (BUG-10).
    expect(quantiteCultureApresModification(auto, { espacement: null })).toBeNull()
  })

  it('paramètres modifiés sans quantité : une quantité saisie à la main est conservée', () => {
    expect(quantiteCultureApresModification({ ...nee, quantite: 120 }, { nbRangs: 2 })).toBeUndefined()
  })

  it('ni quantité ni paramètre dans le corps : rien ne change', () => {
    expect(quantiteCultureApresModification(nee, {})).toBeUndefined()
  })
})
