/**
 * CR-PHY-03 (tour 2) : l'écran du registre restitue la localisation et la
 * conduite biologique figées, pas le seul nom de planche de la fiche actuelle.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LieuTraitementRegistre, type LieuRegistre } from './LieuTraitementRegistre'

const rendu = (entry: LieuRegistre) => renderToStaticMarkup(createElement(LieuTraitementRegistre, { entry }))
const FIGEE = 'Arbre Arbre témoin · Parcelle Verger du haut · Arros-de-Nay · GPS 43.2000000, -0.2500000 (WGS84)'

describe('cellule Localisation du registre phytosanitaire', () => {
  it('traitement d’arbre figé : localisation et conduite bio du jour, plus de « Non renseigné »', () => {
    const html = rendu({ parcelle: 'Non renseigné', localisation: '', localisationReglementaire: FIGEE, conduiteBio: true, contexteFige: true })
    expect(html).toContain('Verger du haut')
    expect(html).toContain('Conduite biologique')
    expect(html).not.toContain('Non renseigné')
    expect(html).not.toContain('Fiche actuelle')
  })

  it('ligne figée : le nom de planche de la fiche actuelle ne concurrence pas la valeur figée', () => {
    const html = rendu({ parcelle: 'Planche renommée', localisation: 'Serre 2', localisationReglementaire: 'Planche A1 · Parcelle Les Graves', conduiteBio: false, contexteFige: true })
    expect(html).toContain('Planche A1 · Parcelle Les Graves')
    expect(html).toContain('Conduite non biologique')
    expect(html).not.toMatch(/Planche renommée|Serre 2/)
  })

  it('ligne ancienne jamais figée : valeur relue des fiches, signalée comme telle', () => {
    const html = rendu({ parcelle: 'Planche A1', localisation: 'Serre 2', localisationReglementaire: 'Planche A1 · Parcelle Les Graves', conduiteBio: true, contexteFige: false })
    expect(html).toContain('Planche A1 · Parcelle Les Graves')
    expect(html).toContain('Fiche actuelle')
  })

  it('ligne ancienne sans localisation réglementaire : repli sur la planche et sa localisation', () => {
    const html = rendu({ parcelle: 'Planche A1', localisation: 'Serre 2' })
    expect(html).toContain('Planche A1')
    expect(html).toContain('Serre 2')
    expect(html).not.toContain('Fiche actuelle')
  })

  it('rien de connu : « Non renseigné », sans mention de conduite', () => {
    const html = rendu({ parcelle: 'Non renseigné', localisation: '', localisationReglementaire: null, conduiteBio: null, contexteFige: false })
    expect(html).toBe('Non renseigné')
  })
})
