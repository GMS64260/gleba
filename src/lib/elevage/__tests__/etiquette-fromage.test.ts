import { describe, expect, it } from 'vitest'
import { mentionDateLimite } from '../etiquette-fromage'

describe('date limite de l’étiquette de fromage', () => {
  const dlc = new Date('2026-11-20T00:00:00Z')
  const dluo = new Date('2027-01-15T00:00:00Z')

  it('imprime la DLC d’un lot frais, qui prime sur la DLUO', () => {
    expect(mentionDateLimite({ dlc, dluo: null })).toEqual({ libelle: "À consommer jusqu'au", date: dlc })
    expect(mentionDateLimite({ dlc, dluo })?.date).toBe(dlc)
  })

  it('imprime la DLUO à défaut, et rien sans date', () => {
    expect(mentionDateLimite({ dlc: null, dluo })).toEqual({ libelle: 'À consommer de préférence avant le', date: dluo })
    expect(mentionDateLimite({})).toBeNull()
  })
})
