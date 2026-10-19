/**
 * Ventilation des revenus par module — ticket cmvflua2x (QA 2026-10-19).
 *
 * Invariant tenu : la somme des modules est le total des revenus (ventes +
 * factures − avoirs), au centime, quelle que soit l'origine des lignes. Le
 * Compte de résultat affichait un écart parce que les modules relisaient les
 * tables métier brutes : une facture saisie sans vente métier n'entrait dans
 * aucun module, un avoir non plus.
 */

import { describe, expect, it } from 'vitest'
import { MODULES_COMPTA } from '../modules'
import {
  moduleDesVentesPortees,
  moduleDeVente,
  ventilerRevenus,
  type FactureAVentiler,
  type VenteAVentiler,
} from '../ventilation-revenus'

const somme = (r: Record<string, number>) => Math.round(Object.values(r).reduce((s, v) => s + v, 0) * 100) / 100

describe('moduleDeVente', () => {
  it('suit le module métier de la vente (miroirs et saisies)', () => {
    expect(moduleDeVente({ module: 'elevage', categorie: 'oeufs' })).toBe('elevage')
    expect(moduleDeVente({ module: 'verger', categorie: 'fruits' })).toBe('verger')
    expect(moduleDeVente({ module: 'potager', categorie: 'legumes' })).toBe('potager')
  })

  it('range les légumes sans module métier au maraîchage, le reste en « Autre »', () => {
    expect(moduleDeVente({ module: 'boutique', categorie: 'legumes' })).toBe('potager')
    expect(moduleDeVente({ module: null, categorie: 'legumes' })).toBe('potager')
    expect(moduleDeVente({ module: 'general', categorie: 'service' })).toBe('autre')
    expect(moduleDeVente({ module: null, categorie: null })).toBe('autre')
  })
})

describe('moduleDesVentesPortees', () => {
  it('donne le module de la vente métier portée par la facture', () => {
    expect(moduleDesVentesPortees({ ventesProduits: 1 })).toBe('elevage')
    expect(moduleDesVentesPortees({ abattages: 2 })).toBe('elevage')
    expect(moduleDesVentesPortees({ recoltesArbres: 1 })).toBe('verger')
    expect(moduleDesVentesPortees({ productionsBois: 1 })).toBe('verger')
    expect(moduleDesVentesPortees({ recoltes: 1 })).toBe('potager')
    expect(moduleDesVentesPortees({ commandesBoutique: 1 })).toBe('autre')
  })

  it("rend null pour une facture saisie sans vente métier", () => {
    expect(moduleDesVentesPortees({})).toBeNull()
    expect(moduleDesVentesPortees({ ventesProduits: 0, recoltes: 0 })).toBeNull()
  })
})

describe('ventilerRevenus', () => {
  const ventes: VenteAVentiler[] = [
    { montant: 300, module: 'potager', categorie: 'legumes' },
    { montant: 120.5, module: 'elevage', categorie: 'oeufs' },
    { montant: 80, module: 'boutique', categorie: 'legumes' },
    { montant: 45.25, module: 'autre', categorie: 'service' },
  ]

  it('la somme des modules est le total des revenus, facture sans vente et avoirs compris', () => {
    const factures: FactureAVentiler[] = [
      { type: 'facture', totalTTC: 211.1, moduleSource: 'elevage' },
      // Facture saisie dans Factures, sans vente métier : elle n'était
      // comptée que dans le total, d'où l'écart du Compte de résultat.
      { type: 'facture', totalTTC: 165.5, moduleSource: null },
      // Avoir sur la facture d'élevage : déduit de l'élevage.
      { type: 'avoir', totalTTC: 37.4, moduleSource: 'elevage' },
    ]
    const v = ventilerRevenus(ventes, factures)

    const attendu = 300 + 120.5 + 80 + 45.25 + 211.1 + 165.5 - 37.4
    expect(v.total).toBe(Math.round(attendu * 100) / 100)
    expect(somme(v.parModule)).toBe(v.total)
    expect(somme(v.composition as unknown as Record<string, number>)).toBe(v.total)

    expect(v.parModule).toEqual({ potager: 380, verger: 0, elevage: 294.2, autre: 210.75 })
    expect(v.composition).toEqual({ ventes: 545.75, facturesRattachees: 211.1, facturesSansVente: 165.5, avoirs: -37.4 })
  })

  it('un avoir sur une facture sans vente se déduit de « Autre »', () => {
    const v = ventilerRevenus([], [
      { type: 'facture', totalTTC: 100, moduleSource: null },
      { type: 'avoir', totalTTC: 30, moduleSource: null },
    ])
    expect(v.parModule.autre).toBe(70)
    expect(v.total).toBe(70)
  })

  it('reporte le reste d’arrondi : les cellules affichées somment au total, même avec des montants au millième', () => {
    // Miroirs quantité × prix : des montants au millième existent en base.
    const v = ventilerRevenus(
      [
        { montant: 8.3325, module: 'potager', categorie: 'legumes' },
        { montant: 4.4425, module: 'verger', categorie: 'fruits' },
        { montant: 1.0025, module: 'elevage', categorie: 'oeufs' },
      ],
      [],
    )
    expect(v.total).toBe(13.78)
    expect(somme(v.parModule)).toBe(13.78)
    for (const m of MODULES_COMPTA) {
      expect(Math.round(v.parModule[m] * 100) / 100).toBe(v.parModule[m])
    }
  })

  it('ne produit aucun NaN sur un montant absent', () => {
    const v = ventilerRevenus([{ montant: Number.NaN, module: 'potager' }], [{ type: 'facture', totalTTC: Number.NaN, moduleSource: null }])
    expect(v.total).toBe(0)
    expect(somme(v.parModule)).toBe(0)
  })
})
