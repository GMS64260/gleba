import { describe, expect, it } from 'vitest'

import { libelleFenetreSemaines } from '@/lib/itp-label'

describe('libelleFenetreSemaines', () => {
  it('écrit la fenêtre complète, ou la seule semaine de début', () => {
    expect(libelleFenetreSemaines(14, 16)).toBe('S14–S16')
    expect(libelleFenetreSemaines(5, null)).toBe('S05')
  })

  it('n’écrit ni « Sundefined » ni « Snull » quand le début manque', () => {
    expect(libelleFenetreSemaines(undefined, 20)).toBe("jusqu'à S20")
    expect(libelleFenetreSemaines(null, 30)).toBe("jusqu'à S30")
    expect(libelleFenetreSemaines(null, null)).toBe('-')
  })
})
