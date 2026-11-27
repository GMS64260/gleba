import { describe, expect, it } from 'vitest'
import { corpsDelaiModifie, corpsDelaiTraitement, delaiTraitementASaisir } from './delai-traitement'

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

  it('n’envoie que le champ changé depuis l’ouverture', () => {
    const lu = { dar: 8, natureProduit: null }
    expect(corpsDelaiModifie(lu, { dar: '8', natureProduit: 'amm' })).toEqual({ natureProduit: 'amm' })
    expect(corpsDelaiModifie(lu, { dar: '21', natureProduit: '' })).toEqual({ dar: 21 })
    expect(corpsDelaiModifie(lu, { dar: '', natureProduit: '' })).toEqual({ dar: null })
    expect(corpsDelaiModifie(lu, { dar: '8', natureProduit: '' })).toEqual({})
    expect(corpsDelaiModifie({ dar: 0 }, { dar: '0', natureProduit: '' })).toEqual({})
  })
})
