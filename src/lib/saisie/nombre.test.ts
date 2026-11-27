import { describe, expect, it } from 'vitest'
import {
  filtrerSaisieDecimale,
  lireNombreSaisi,
  nombreSaisiValide,
  versChampNombre,
} from './nombre'

describe('versChampNombre', () => {
  it('garde le zéro, qui n’est pas une absence (D58)', () => {
    expect(versChampNombre(0)).toBe('0')
    expect(versChampNombre(12.5)).toBe('12.5')
  })
  it('rend un champ vide pour une valeur absente', () => {
    expect(versChampNombre(null)).toBe('')
    expect(versChampNombre(undefined)).toBe('')
    expect(versChampNombre(NaN)).toBe('')
  })
})

describe('lireNombreSaisi', () => {
  it('lit la virgule décimale comme le point (D72)', () => {
    expect(lireNombreSaisi('2,50')).toBe(2.5)
    expect(lireNombreSaisi('2.50')).toBe(2.5)
    expect(lireNombreSaisi('0,04')).toBe(0.04)
    expect(lireNombreSaisi(',5')).toBe(0.5)
    expect(lireNombreSaisi('2,')).toBe(2)
  })
  it('ignore les espaces de milliers', () => {
    expect(lireNombreSaisi('1 200,5')).toBe(1200.5)
    expect(lireNombreSaisi('1 200')).toBe(1200)
  })
  it('lit un séparateur de milliers quand point et virgule sont tous deux présents, et refuse l’ambigu', () => {
    expect(lireNombreSaisi('1.234,56')).toBe(1234.56)
    expect(lireNombreSaisi('1,234.56')).toBe(1234.56)
    expect(lireNombreSaisi('12.345.678,9')).toBe(12345678.9)
    expect(lireNombreSaisi('1.23,45')).toBeNaN()
    expect(lireNombreSaisi('1,2.3,4')).toBeNaN()
  })

  it('distingue le champ vide de la saisie illisible', () => {
    expect(lireNombreSaisi('')).toBeNull()
    expect(lireNombreSaisi('   ')).toBeNull()
    expect(lireNombreSaisi(null)).toBeNull()
    expect(lireNombreSaisi('abc')).toBeNaN()
    expect(lireNombreSaisi('1,2,3')).toBeNaN()
    expect(lireNombreSaisi('2e3')).toBeNaN()
  })
  it('lit un zéro et un négatif', () => {
    expect(lireNombreSaisi('0')).toBe(0)
    expect(lireNombreSaisi('-3,5')).toBe(-3.5)
  })
})

describe('nombreSaisiValide', () => {
  it('accepte le vide et applique les bornes', () => {
    expect(nombreSaisiValide('')).toBe(true)
    expect(nombreSaisiValide('abc')).toBe(false)
    expect(nombreSaisiValide('-2', { min: 0 })).toBe(false)
    expect(nombreSaisiValide('0', { min: 0 })).toBe(true)
    expect(nombreSaisiValide('0', { min: 0, strict: true })).toBe(false)
    expect(nombreSaisiValide('11', { max: 10 })).toBe(false)
  })
})

describe('filtrerSaisieDecimale', () => {
  it('ne garde que chiffres, espaces et séparateurs, sans en retirer un en silence', () => {
    expect(filtrerSaisieDecimale('2,50')).toBe('2,50')
    expect(filtrerSaisieDecimale('12 kg')).toBe('12 ')
    expect(filtrerSaisieDecimale('1.234,56')).toBe('1.234,56')
    // Le signe reste visible, pour que le formulaire refuse au lieu d'enregistrer 4 (D114).
    expect(filtrerSaisieDecimale('-4')).toBe('-4')
    expect(filtrerSaisieDecimale('4-2')).toBe('42')
  })
})
