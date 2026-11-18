/**
 * Rattachement d'une facture à une fiche client — ticket cmvfljaru (QA
 * 2026-10-19). Règles partagées par la route de création et le formulaire.
 */

import { describe, expect, it } from 'vitest'
import { acheteurDeFacture, adresseDeFiche, clientDesigneParNom, identiteAcheteur, instantaneAcheteur, normaliserNomClient } from '../rattachement-client'

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

// BX03 (2026-11-16) : identité complète de l'acheteur figée à l'émission.
describe('acheteur figé', () => {
  const ficheParticulier = { nom: 'Camille Fictive', type: 'particulier', email: 'camille@example.invalid', adresse: '3 chemin fictif', codePostal: '64000', ville: 'Pau', pays: 'France' }
  const fichePro = { nom: 'Fictive SARL', type: 'professionnel', email: 'achats@example.invalid', adresse: '9 quai fictif', codePostal: '64100', ville: 'Bayonne', pays: 'France', siret: '12345678900017', siren: '123456789', tvaIntra: 'FR00123456789' }

  it('instantaneAcheteur fige toute l’identité de la fiche', () => {
    expect(instantaneAcheteur(ficheParticulier)).toEqual({
      clientNom: 'Camille Fictive', clientAdresse: '3 chemin fictif, 64000, Pau', clientEmail: 'camille@example.invalid',
      clientCodePostal: '64000', clientVille: 'Pau', clientPays: 'France', clientType: 'particulier',
      clientSiret: null, clientSiren: null, clientTvaIntra: null,
    })
    expect(instantaneAcheteur({ nom: 'Sans adresse' }, 'Adresse saisie').clientAdresse).toBe('Adresse saisie')
  })

  it('facture figée : la fiche modifiée n’est jamais relue', () => {
    const facture = { ...instantaneAcheteur(ficheParticulier), acheteurFigeLe: new Date('2026-11-16'), client: fichePro }
    expect(acheteurDeFacture(facture)).toEqual({
      nom: 'Camille Fictive', adresse: '3 chemin fictif, 64000, Pau', siret: null, siren: null, tvaIntra: null,
      email: 'camille@example.invalid', codePostal: '64000', ville: 'Pau', pays: 'France', type: 'particulier', fige: true,
    })
  })

  it('facture antérieure non figée : champs absents conservés, sans repli courant', () => {
    const ancienne = {
      clientNom: 'Camille Fictive', clientAdresse: '3 chemin fictif', clientSiret: null, clientSiren: null, clientTvaIntra: null,
      clientEmail: null, clientCodePostal: null, clientVille: null, clientPays: null, clientType: null, acheteurFigeLe: null, client: fichePro,
    }
    expect(acheteurDeFacture(ancienne)).toEqual({
      nom: 'Camille Fictive', adresse: '3 chemin fictif', siret: null, siren: null, tvaIntra: null,
      email: null, codePostal: null, ville: null, pays: null, type: null, fige: false,
    })
    expect(acheteurDeFacture({ ...ancienne, client: null }).fige).toBe(false)
  })
})
