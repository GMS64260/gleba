import { describe, it, expect } from 'vitest'
import { isValidIban, isValidBic, formatIban } from '../iban'

describe('isValidIban', () => {
  it('valide un IBAN FR correct', () => {
    // IBAN FR de test (BNP Paribas) — modulo 97 = 1
    expect(isValidIban('FR1420041010050500013M02606')).toBe(true)
  })

  it('valide un IBAN DE correct', () => {
    expect(isValidIban('DE89370400440532013000')).toBe(true)
  })

  it('valide un IBAN GB correct', () => {
    expect(isValidIban('GB29NWBK60161331926819')).toBe(true)
  })

  it('tolère les espaces et la casse', () => {
    expect(isValidIban('fr14 2004 1010 0505 0001 3M02 606')).toBe(true)
  })

  it('refuse un IBAN avec clé fausse', () => {
    expect(isValidIban('FR9999041010050500013M02606')).toBe(false)
  })

  it('refuse un IBAN FR avec mauvaise longueur', () => {
    expect(isValidIban('FR1420041010050500013M02')).toBe(false)
  })

  it('refuse null/undefined/empty', () => {
    expect(isValidIban(null)).toBe(false)
    expect(isValidIban('')).toBe(false)
    expect(isValidIban(undefined)).toBe(false)
  })

  it('refuse les caractères non-alphanum', () => {
    expect(isValidIban('FR14-2004-1010')).toBe(false)
  })
})

describe('isValidBic', () => {
  it('valide BIC 8 caractères', () => {
    expect(isValidBic('BNPAFRPP')).toBe(true)
  })

  it('valide BIC 11 caractères', () => {
    expect(isValidBic('BNPAFRPPXXX')).toBe(true)
  })

  it('refuse format invalide', () => {
    expect(isValidBic('123ABCDE')).toBe(false)
    expect(isValidBic('TROPCOURT')).toBe(false)
    expect(isValidBic(null)).toBe(false)
  })

  it('tolère casse + espaces', () => {
    expect(isValidBic('bnpa frpp')).toBe(true)
  })
})

describe('formatIban', () => {
  it('groupe par 4 caractères', () => {
    expect(formatIban('FR1420041010050500013M02606')).toBe('FR14 2004 1010 0505 0001 3M02 606')
  })

  it('vide → vide', () => {
    expect(formatIban(null)).toBe('')
    expect(formatIban('')).toBe('')
  })
})
