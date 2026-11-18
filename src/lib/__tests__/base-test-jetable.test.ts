import { describe, expect, it } from 'vitest'
import { estBaseTestJetable } from './helpers/base-test-jetable'

const urlBase = (nom: string) => `postgresql://localhost/${nom}`

describe('garde de base jetable des tests d’intégration', () => {
  it.each(['gleba_tests', 'gleba_tests_phyto', 'gleba_tests_a1_b2'])('accepte %s', (nom) => {
    const url = urlBase(nom)
    expect(estBaseTestJetable(url, url)).toBe(true)
  })

  it.each(['gleba', 'gleba_tests_', 'gleba_tests_suffixe-autre', 'gleba_tests_MAJ', 'autre_gleba_tests', 'gleba_tests/ailleurs'])('refuse %s', (nom) => {
    const url = urlBase(nom)
    expect(estBaseTestJetable(url, url)).toBe(false)
  })

  it.each([
    [undefined, undefined],
    ['', ''],
    [urlBase('gleba_tests'), undefined],
    [undefined, urlBase('gleba_tests')],
    [urlBase('gleba_tests'), urlBase('gleba_tests_autre')],
    ['url invalide', 'url invalide'],
  ])('refuse une configuration absente, différente ou invalide (%s, %s)', (url, testUrl) => {
    expect(estBaseTestJetable(url, testUrl)).toBe(false)
  })
})
