import { describe, expect, it } from 'vitest'
import { deviseCommuneDesSeries, libellesTotauxParDevise, sommerParDevise, soustraireParDevise, totalSiUneDevise, TOTAL_DEVISE_INCONNUE } from '../totaux-devise'

const net = (l: string[]) => l.map(s => s.replace(/[  ]/g, ' '))

describe('libellesTotauxParDevise', () => {
  it('garde la devise figée du groupe, pas la devise courante', () => {
    expect(net(libellesTotauxParDevise([{ monnaie: 'EUR', montant: 52.75 }], 'XPF'))).toEqual(['52,75 €'])
  })
  it('un libellé par devise non nulle, inconnue signalée', () => {
    expect(net(libellesTotauxParDevise([
      { monnaie: 'EUR', montant: 0 }, { monnaie: 'XPF', montant: 5000 }, { monnaie: null, montant: 3 },
    ], 'EUR'))).toEqual(['5 000 F', TOTAL_DEVISE_INCONNUE])
  })
  it('tout à zéro : un zéro dans la première devise connue, sinon la courante, sinon un tiret', () => {
    expect(net(libellesTotauxParDevise([{ monnaie: 'EUR', montant: 0 }], 'XPF'))).toEqual(['0,00 €'])
    expect(net(libellesTotauxParDevise([], 'XPF'))).toEqual(['0 F'])
    expect(libellesTotauxParDevise([], null)).toEqual(['—'])
  })
})

describe('totaux par devise des API (lot devise-totaux-api)', () => {
  const lignes = [
    { m: 'EUR' as const, v: 105.5 }, { m: 'XPF' as const, v: 1000 }, { m: 'EUR' as const, v: 211 }, { m: null, v: 3.1 },
  ]
  it('additionne devise par devise, ordre EUR, XPF, inconnue, au centime', () => {
    expect(sommerParDevise(lignes, l => l.m, l => l.v, 'XPF')).toEqual([
      { monnaie: 'EUR', total: 316.5, count: 2 },
      { monnaie: 'XPF', total: 1000, count: 1 },
      { monnaie: null, total: 3.1, count: 1 },
    ])
  })
  it('sans élément : un seul total à zéro dans la devise courante', () => {
    expect(sommerParDevise([], () => 'EUR', () => 1, 'XPF')).toEqual([{ monnaie: 'XPF', total: 0, count: 0 }])
  })
  it('le total historique est rempli pour une devise et null dès que deux coexistent', () => {
    expect(totalSiUneDevise([{ total: 12.5 }])).toBe(12.5)
    expect(totalSiUneDevise([])).toBe(0)
    expect(totalSiUneDevise([{ total: 1 }, { total: 2 }])).toBeNull()
  })
  it('le bénéfice se soustrait devise par devise, sans conversion', () => {
    expect(soustraireParDevise(
      [{ monnaie: 'EUR', total: 316.5, count: 2 }, { monnaie: 'XPF', total: 1000, count: 1 }],
      [{ monnaie: 'XPF', total: 250 }],
    )).toEqual([{ monnaie: 'EUR', total: 316.5 }, { monnaie: 'XPF', total: 750 }])
    // Groupe vide de revenus (aucune écriture) : seule la devise des dépenses reste.
    expect(soustraireParDevise([{ monnaie: 'EUR', total: 0, count: 0 }], [{ monnaie: 'XPF', total: 40 }]))
      .toEqual([{ monnaie: 'XPF', total: -40 }])
    expect(soustraireParDevise([{ monnaie: 'EUR', total: 0, count: 0 }], [{ monnaie: 'EUR', total: 0, count: 0 }]))
      .toEqual([{ monnaie: 'EUR', total: 0 }])
    // QA32 BENEFICE_SANS_DEPENSE : un groupe à zéro sans `count` (aucune
    // écriture) ne crée plus de seconde devise.
    expect(soustraireParDevise([{ monnaie: 'EUR', total: 316.5, count: 2 }], [{ monnaie: 'XPF', total: 0 }]))
      .toEqual([{ monnaie: 'EUR', total: 316.5 }])
  })
})

describe('deviseCommuneDesSeries (graphiques à plusieurs séries)', () => {
  it('séries chacune mono-devise mais de devises différentes : indisponible', () => {
    expect(deviseCommuneDesSeries([
      { valeur: 1000, parDevise: [{ monnaie: 'XPF', total: 1000, count: 1 }] },
      { valeur: 100, parDevise: [{ monnaie: 'EUR', total: 100, count: 1 }] },
    ], 'XPF')).toBeNull()
  })
  it('une devise commune, groupes vides ignorés ; aucune devise : la devise par défaut', () => {
    expect(deviseCommuneDesSeries([
      { valeur: 1000, parDevise: [{ monnaie: 'EUR', total: 1000, count: 1 }] },
      { valeur: 0, parDevise: [{ monnaie: 'XPF', total: 0, count: 0 }] },
    ], 'XPF')).toEqual({ monnaie: 'EUR' })
    expect(deviseCommuneDesSeries([{ valeur: 0, parDevise: [] }], 'XPF')).toEqual({ monnaie: 'XPF' })
  })
  it('un montant sans ventilation ou un total null : devise inconnue, indisponible', () => {
    expect(deviseCommuneDesSeries([{ valeur: 5 }], 'EUR')).toBeNull()
    expect(deviseCommuneDesSeries([{ valeur: null }], 'EUR')).toBeNull()
    expect(deviseCommuneDesSeries([{ valeur: 0 }], 'EUR')).toEqual({ monnaie: 'EUR' })
  })
})
