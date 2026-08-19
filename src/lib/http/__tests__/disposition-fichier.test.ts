/**
 * Contrat des documents servis par l'API — livré le 2026-08-19.
 *
 * Un PDF s'affiche dans la fenêtre ; il ne se télécharge que sur demande
 * explicite. Ces tests tiennent les deux moitiés de la règle, plus l'assainis-
 * sement du nom de fichier — plusieurs noms sont composés à partir de saisies
 * utilisateur (nom d'un animal, d'un acquéreur, d'un lot), et un guillemet y
 * couperait l'en-tête HTTP.
 */

import { describe, it, expect } from 'vitest'
import {
  dispositionDocument,
  dispositionTelechargement,
  nomFichierSur,
  veutTelechargement,
} from '../disposition-fichier'

const URL_BASE = 'https://gleba.fr/api/elevage/registre-sanitaire?year=2026'

describe('veutTelechargement', () => {
  it('est faux sans paramètre : un document s’affiche par défaut', () => {
    expect(veutTelechargement(URL_BASE)).toBe(false)
    expect(veutTelechargement('https://gleba.fr/api/x')).toBe(false)
  })

  it('reconnaît les deux paramètres et leurs valeurs usuelles', () => {
    expect(veutTelechargement(`${URL_BASE}&telecharger=1`)).toBe(true)
    expect(veutTelechargement(`${URL_BASE}&download=1`)).toBe(true)
    expect(veutTelechargement(`${URL_BASE}&telecharger=true`)).toBe(true)
    expect(veutTelechargement(`${URL_BASE}&telecharger=oui`)).toBe(true)
    // Paramètre présent sans valeur : intention claire.
    expect(veutTelechargement(`${URL_BASE}&telecharger`)).toBe(true)
  })

  it('ignore une valeur négative ou incongrue', () => {
    expect(veutTelechargement(`${URL_BASE}&telecharger=0`)).toBe(false)
    expect(veutTelechargement(`${URL_BASE}&telecharger=non`)).toBe(false)
  })

  it('accepte une requête Next (objet porteur d’une url) et une URL', () => {
    expect(veutTelechargement({ url: `${URL_BASE}&telecharger=1` })).toBe(true)
    expect(veutTelechargement(new URL(`${URL_BASE}&telecharger=1`))).toBe(true)
  })

  it('ne jette pas sur une url illisible', () => {
    expect(veutTelechargement('pas une url')).toBe(false)
  })
})

describe('dispositionDocument', () => {
  it('rend inline par défaut', () => {
    expect(dispositionDocument(URL_BASE, 'registre-sanitaire-2026.pdf')).toBe(
      'inline; filename="registre-sanitaire-2026.pdf"',
    )
  })

  it('rend attachment quand le téléchargement est demandé', () => {
    expect(dispositionDocument(`${URL_BASE}&telecharger=1`, 'registre-sanitaire-2026.pdf')).toBe(
      'attachment; filename="registre-sanitaire-2026.pdf"',
    )
  })

  it('neutralise un nom de fichier issu d’une saisie utilisateur', () => {
    const entete = dispositionDocument(URL_BASE, 'contrat-"Jean";rm -rf.pdf')
    expect(entete.startsWith('inline; filename="')).toBe(true)
    // Un seul guillemet ouvrant et un seul fermant : l'en-tête ne peut pas être coupé.
    expect(entete.split('"').length - 1).toBe(2)
    expect(entete).not.toContain(';rm')
  })
})

describe('nomFichierSur', () => {
  it('remplace les caractères qui casseraient l’en-tête', () => {
    expect(nomFichierSur('a/b\\c:d*e?f<g>h|i"j.pdf')).toBe('a-b-c-d-e-f-g-h-i-j.pdf')
  })

  it('conserve les accents et les espaces internes', () => {
    expect(nomFichierSur('Étiquette lot Tomme d’été.pdf')).toBe('Étiquette lot Tomme d’été.pdf')
  })

  it('retombe sur un nom neutre plutôt que sur un nom vide', () => {
    expect(nomFichierSur('   ')).toBe('document')
    expect(nomFichierSur('"')).toBe('-')
  })
})

describe('dispositionTelechargement', () => {
  it('force toujours le téléchargement (CSV, ZIP, XML)', () => {
    expect(dispositionTelechargement('registre-phyto.csv')).toBe(
      'attachment; filename="registre-phyto.csv"',
    )
  })
})
