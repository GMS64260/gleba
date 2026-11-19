import { describe, expect, it } from 'vitest'
import { corpsDelaiTraitement, delaiTraitementASaisir } from './delai-traitement'

describe('délai avant récolte d’un traitement d’arbre', () => {
  it('reste à saisir sur un traitement sans délai, sauf biostimulant', () => {
    expect(delaiTraitementASaisir({ id: 1, type: 'traitement' })).toBe(true)
    expect(delaiTraitementASaisir({ id: 1, type: 'traitement', dar: 0 })).toBe(false)
    expect(delaiTraitementASaisir({ id: 1, type: 'traitement', natureProduit: 'biostimulant' })).toBe(false)
    expect(delaiTraitementASaisir({ id: 1, type: 'taille' })).toBe(false)
  })

  it('envoie zéro comme zéro et un champ vide comme effacement', () => {
    expect(corpsDelaiTraitement({ dar: '0', natureProduit: 'amm' })).toEqual({ dar: 0, natureProduit: 'amm' })
    expect(corpsDelaiTraitement({ dar: ' ', natureProduit: '' })).toEqual({ dar: null, natureProduit: null })
  })
})
