/**
 * Rattachement d'une facture à une fiche client — ticket cmvfljaru (QA
 * 2026-10-19). Règles partagées par la route de création et le formulaire.
 */

import { describe, expect, it } from 'vitest'
import { adresseDeFiche, clientDesigneParNom, identiteAcheteur, normaliserNomClient } from '../rattachement-client'

describe('normaliserNomClient', () => {
  it('ignore casse, accents et espaces superflus', () => {
    expect(normaliserNomClient('  Épicerie   du  Marché ')).toBe('epicerie du marche')
    expect(normaliserNomClient('EPICERIE DU MARCHE')).toBe('epicerie du marche')
  })
})

describe('clientDesigneParNom', () => {
  const fiches = [
    { id: 9, nom: 'Restaurant du Port' },
    { id: 10, nom: 'Épicerie du Marché' },
  ]

  it('désigne la seule fiche de même nom normalisé', () => {
    expect(clientDesigneParNom(fiches, 'restaurant du  port')?.id).toBe(9)
    expect(clientDesigneParNom(fiches, 'Epicerie du Marche')?.id).toBe(10)
  })

  it('ne désigne rien pour un nom partiel, vide ou inconnu', () => {
    expect(clientDesigneParNom(fiches, 'Restaurant')).toBeNull()
    expect(clientDesigneParNom(fiches, '   ')).toBeNull()
    expect(clientDesigneParNom(fiches, null)).toBeNull()
    expect(clientDesigneParNom(fiches, 'Client de passage')).toBeNull()
  })

  it('ne choisit pas entre deux homonymes', () => {
    expect(clientDesigneParNom([...fiches, { id: 11, nom: 'RESTAURANT DU PORT' }], 'Restaurant du Port')).toBeNull()
  })
})

describe('identiteAcheteur', () => {
  it('fige SIRET, SIREN dérivé du SIRET et TVA intracommunautaire', () => {
    expect(identiteAcheteur({ siret: '73282932000074', siren: null, tvaIntra: 'FR44732829320' })).toEqual({
      clientSiret: '73282932000074',
      clientSiren: '732829320',
      clientTvaIntra: 'FR44732829320',
    })
  })

  it('garde le SIREN saisi et rend null ce qui manque', () => {
    expect(identiteAcheteur({ siret: null, siren: '732829320', tvaIntra: ' ' })).toEqual({
      clientSiret: null,
      clientSiren: '732829320',
      clientTvaIntra: null,
    })
  })
})

describe('adresseDeFiche', () => {
  it('joint voie, code postal et ville présents', () => {
    expect(adresseDeFiche({ adresse: '2 quai des Pêcheurs', codePostal: '64500', ville: 'Ciboure' })).toBe('2 quai des Pêcheurs, 64500, Ciboure')
    expect(adresseDeFiche({ adresse: null, codePostal: '', ville: 'Ciboure' })).toBe('Ciboure')
    expect(adresseDeFiche({})).toBe('')
  })
})
