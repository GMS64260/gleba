/**
 * Écran d'aperçu des documents — livré le 2026-08-19.
 *
 * `src` arrive par la query de `/apercu` : l'écran ne doit charger que des
 * documents de NOTRE API. Sans ce contrôle, un lien forgé ferait charger une URL
 * étrangère sous le domaine de Gleba (fuite de session, hameçonnage). C'est la
 * seule partie de la fonctionnalité qui décide d'une frontière de sécurité,
 * donc celle qu'on verrouille par des tests.
 */

import { describe, it, expect } from 'vitest'
import { cheminDocumentValide, urlApercu, urlTelechargement } from '../apercu-document'

describe('cheminDocumentValide', () => {
  it('accepte un chemin de document de l’API, avec ou sans query', () => {
    expect(cheminDocumentValide('/api/elevage/registre-sanitaire?year=2026')).toBe(true)
    expect(cheminDocumentValide('/api/comptabilite/factures/12/pdf')).toBe(true)
  })

  it('refuse une URL absolue, même vers gleba.fr', () => {
    expect(cheminDocumentValide('https://gleba.fr/api/x')).toBe(false)
    expect(cheminDocumentValide('http://ailleurs.example/api/x')).toBe(false)
  })

  it('refuse un chemin protocole-relatif', () => {
    expect(cheminDocumentValide('//ailleurs.example/api/x')).toBe(false)
  })

  it('refuse un pseudo-protocole', () => {
    expect(cheminDocumentValide('javascript:alert(1)')).toBe(false)
    expect(cheminDocumentValide('/api/x:javascript:alert(1)')).toBe(false)
  })

  it('refuse ce qui n’est pas un document de l’API', () => {
    expect(cheminDocumentValide('/parametres')).toBe(false)
    expect(cheminDocumentValide('/apiary/x')).toBe(false)
    expect(cheminDocumentValide('')).toBe(false)
    expect(cheminDocumentValide(null)).toBe(false)
    expect(cheminDocumentValide(undefined)).toBe(false)
  })

  it('tolère un « : » dans les paramètres, qui y est légitime', () => {
    expect(cheminDocumentValide('/api/x?titre=10:30')).toBe(true)
  })
})

describe('urlApercu', () => {
  it('encode le chemin du document et son titre', () => {
    const url = urlApercu('/api/elevage/registre-sanitaire?year=2026', 'Registre sanitaire 2026')
    expect(url.startsWith('/apercu?')).toBe(true)
    const params = new URLSearchParams(url.slice('/apercu?'.length))
    expect(params.get('src')).toBe('/api/elevage/registre-sanitaire?year=2026')
    expect(params.get('titre')).toBe('Registre sanitaire 2026')
  })

  it('omet le titre quand il n’est pas fourni', () => {
    expect(urlApercu('/api/x')).toBe('/apercu?src=%2Fapi%2Fx')
  })
})

describe('urlTelechargement', () => {
  it('ajoute le paramètre au bon endroit selon la query existante', () => {
    expect(urlTelechargement('/api/x')).toBe('/api/x?telecharger=1')
    expect(urlTelechargement('/api/x?year=2026')).toBe('/api/x?year=2026&telecharger=1')
  })
})
