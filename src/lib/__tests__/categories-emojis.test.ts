import { describe, expect, it } from 'vitest'

import { getCategorieEmoji, getEspeceEmoji } from '@/lib/categories-emojis'

/**
 * L'icône botanique se choisit d'abord par le NOM (mot entier), sinon par la
 * catégorie. La version initiale (PR #35) matchait par inclusion : « Poireau »
 * contenait « poire » et recevait une poire.
 */
describe('getEspeceEmoji', () => {
  it('ne confond pas un mot avec un nom qui le contient', () => {
    expect(getEspeceEmoji('Poireau', 'bulbe')).not.toBe('🍐')
    expect(getEspeceEmoji('Poirier', 'fruitier')).toBe('🍐')
  })

  it('les noms composés priment sur leurs mots (pomme de terre ≠ pomme)', () => {
    expect(getEspeceEmoji('Pomme de terre', null)).toBe('🥔')
    expect(getEspeceEmoji('Pommier', 'fruitier')).toBe('🍎')
    expect(getEspeceEmoji('Patate douce', null)).toBe('🍠')
  })

  it('découpe aussi sur les tirets et apostrophes', () => {
    expect(getEspeceEmoji('Chou-fleur', null)).toBe('🥬')
    expect(getEspeceEmoji('Chou de Bruxelles', null)).toBe('🥬')
  })

  it('est insensible aux accents', () => {
    expect(getEspeceEmoji('Pêcher', 'fruitier')).toBe('🍑')
    expect(getEspeceEmoji('Maïs', 'grain')).toBe('🌽')
  })

  it("retombe sur la catégorie quand le nom n'est pas connu", () => {
    expect(getEspeceEmoji('Salsifis', 'racine')).toBe('🥕')
    expect(getEspeceEmoji('Inconnue', null)).toBe('')
  })
})

describe('getCategorieEmoji', () => {
  it('connaît les valeurs réelles de especes.categorie', () => {
    // Valeurs constatées en base le 2026-08-31 : fruitier, petit_fruit,
    // fruit_legume, engrais_vert… La PR #35 les avait remplacées par des
    // libellés à espaces qui ne matchaient plus rien.
    expect(getCategorieEmoji('fruitier')).toBe('🍎')
    expect(getCategorieEmoji('petit_fruit')).toBe('🍓')
    expect(getCategorieEmoji('fruit_legume')).toBe('🍆')
    expect(getCategorieEmoji('engrais_vert')).toBe('🟩')
    expect(getCategorieEmoji('mellifere')).toBe('🐝')
  })

  it("rend une chaîne vide plutôt qu'un emoji faux", () => {
    expect(getCategorieEmoji(null)).toBe('')
    expect(getCategorieEmoji('categorie-inconnue')).toBe('')
  })
})
