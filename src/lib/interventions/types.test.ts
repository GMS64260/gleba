import { describe, expect, it } from 'vitest'

import { TYPES_INTERVENTION, libelleTypeIntervention } from './types'

describe("types d'intervention (QA cmv2r21ns)", () => {
  it('propose les gestes de conduite des fleurs coupées et le repiquage', () => {
    const valeurs = TYPES_INTERVENTION.map((t) => t.value)
    for (const geste of ['repiquage', 'pincement', 'palissage']) expect(valeurs).toContain(geste)
    expect(new Set(valeurs).size).toBe(valeurs.length)
  })

  it('libellé accentué pour un type connu, repli lisible sinon', () => {
    expect(libelleTypeIntervention('desherbage')).toBe('Désherbage')
    expect(libelleTypeIntervention('Ebourgeonnage')).toBe('Ébourgeonnage')
    expect(libelleTypeIntervention('traitement_phyto')).toBe('Traitement phyto')
    expect(libelleTypeIntervention('buttage_leger')).toBe('Buttage leger')
    expect(libelleTypeIntervention(null)).toBe('Intervention')
  })
})
