/**
 * Ventilation par module d'imputation — ticket cmsx69cuc (QA 2026-08-17).
 *
 * L'invariant tenu ici est celui que l'écran promet : la somme des postes de la
 * ventilation est ÉGALE au total des écritures fournies. C'est ce qui manquait :
 * les modules hors des quatre postes (`general`, `boutique`) étaient ignorés par
 * quatre filtres successifs, et 3 690 € de charges n'apparaissaient nulle part.
 */

import { describe, it, expect } from 'vitest'
import {
  MODULE_COMPTA_LABELS,
  MODULES_COMPTA,
  bucketModuleCompta,
  ventilationVide,
  ventilerParModule,
} from '../modules'

describe('bucketModuleCompta', () => {
  it('reconnaît les quatre modules de saisie', () => {
    expect(bucketModuleCompta('potager')).toBe('potager')
    expect(bucketModuleCompta('verger')).toBe('verger')
    expect(bucketModuleCompta('elevage')).toBe('elevage')
    expect(bucketModuleCompta('autre')).toBe('autre')
  })

  it('accepte « maraichage » comme alias de potager', () => {
    expect(bucketModuleCompta('maraichage')).toBe('potager')
  })

  it('range en « autre » les valeurs internes hors liste plutôt que de les perdre', () => {
    expect(bucketModuleCompta('general')).toBe('autre')
    expect(bucketModuleCompta('boutique')).toBe('autre')
    expect(bucketModuleCompta('inconnu-2027')).toBe('autre')
  })

  it('tolère la casse, les espaces, le vide et le nul', () => {
    expect(bucketModuleCompta(' Potager ')).toBe('potager')
    expect(bucketModuleCompta('ELEVAGE')).toBe('elevage')
    expect(bucketModuleCompta('')).toBe('autre')
    expect(bucketModuleCompta(null)).toBe('autre')
    expect(bucketModuleCompta(undefined)).toBe('autre')
  })
})

describe('ventilerParModule', () => {
  const ecritures = [
    { montant: 3018, module: 'potager' },
    { montant: 320, module: 'elevage' },
    { montant: 3690, module: 'general' },
    { montant: 756, module: 'autre' },
    { montant: 9.5, module: null },
  ]

  it('somme chaque poste sur le module de l’écriture', () => {
    const ventilation = ventilerParModule(ecritures, (e) => e.montant, (e) => e.module)
    expect(ventilation.potager).toBe(3018)
    expect(ventilation.elevage).toBe(320)
    expect(ventilation.verger).toBe(0)
    // 3 690 € `general` + 756 € `autre` + 9,50 € sans module.
    expect(ventilation.autre).toBe(4455.5)
  })

  it('conserve le total : la somme des postes égale la somme des montants', () => {
    const ventilation = ventilerParModule(ecritures, (e) => e.montant, (e) => e.module)
    const total = ecritures.reduce((somme, e) => somme + e.montant, 0)
    const sommeVentilation = MODULES_COMPTA.reduce((somme, m) => somme + ventilation[m], 0)
    expect(sommeVentilation).toBeCloseTo(total, 6)
  })

  it('rend une ventilation à zéro sans écriture', () => {
    expect(ventilerParModule([], () => 0, () => null)).toEqual(ventilationVide())
  })
})

describe('MODULE_COMPTA_LABELS', () => {
  it('nomme « Maraîchage » le module stocké « potager » (convention des écrans)', () => {
    expect(MODULE_COMPTA_LABELS.potager).toBe('Maraîchage')
  })

  it('couvre les quatre postes', () => {
    for (const module of MODULES_COMPTA) {
      expect(MODULE_COMPTA_LABELS[module]).toBeTruthy()
    }
  })
})
