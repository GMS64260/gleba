import { describe, expect, it } from 'vitest'
import { contientLitteral } from './like'

describe('contientLitteral', () => {
  it('échappe les jokers du LIKE et la barre oblique inverse', () => {
    expect(contientLitteral('100 %')).toEqual({ contains: '100 \\%', mode: 'insensitive' })
    expect(contientLitteral('a_b')).toEqual({ contains: 'a\\_b', mode: 'insensitive' })
    expect(contientLitteral('c\\d')).toEqual({ contains: 'c\\\\d', mode: 'insensitive' })
  })

  it('laisse un texte ordinaire tel quel', () => {
    expect(contientLitteral('tomate')).toEqual({ contains: 'tomate', mode: 'insensitive' })
  })
})
