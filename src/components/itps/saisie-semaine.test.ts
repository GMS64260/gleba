import { describe, expect, it } from 'vitest'
import { lireSaisieEntiere, saisieDepuisValeur } from './saisie-semaine'

describe('lireSaisieEntiere', () => {
  it('lit une semaine valide', () => {
    expect(lireSaisieEntiere('51', 1, 52)).toEqual({ valeur: 51, erreur: null })
    expect(lireSaisieEntiere(' 1 ', 1, 52)).toEqual({ valeur: 1, erreur: null })
  })

  it('distingue le champ vidé de la saisie invalide', () => {
    expect(lireSaisieEntiere('', 1, 52)).toEqual({ valeur: null, erreur: null })
    expect(lireSaisieEntiere('53', 1, 52)).toEqual({ valeur: null, erreur: 'De 1 à 52' })
    expect(lireSaisieEntiere('0', 1, 52).erreur).toBe('De 1 à 52')
  })

  it('refuse ce qui n’est pas un entier au lieu de le tronquer', () => {
    expect(lireSaisieEntiere('5.5', 1, 52).erreur).toBe('Nombre entier de 1 à 52')
    expect(lireSaisieEntiere('-2', 0, 52).erreur).toBe('Nombre entier de 0 à 52')
  })

  it('accepte une durée nulle', () => {
    expect(lireSaisieEntiere('0', 0, 52)).toEqual({ valeur: 0, erreur: null })
  })
})

describe('saisieDepuisValeur', () => {
  it('garde le zéro et vide l’absence de valeur', () => {
    expect(saisieDepuisValeur(0)).toBe('0')
    expect(saisieDepuisValeur(null)).toBe('')
  })
})
