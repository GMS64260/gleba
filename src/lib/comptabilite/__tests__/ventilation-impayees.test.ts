import { describe, expect, it } from 'vitest'
import { projeterDevisesImpayees, ventilerImpayeesParDevise } from '../ventilation-impayees'

// Module public : la page Factures du dépôt public s'en sert sans la surcharge
// privée de `impayees.ts` (B15, frontière public/privé).
describe('projeterDevisesImpayees — devise figée lue dans les pièces sources', () => {
  const xpf = { territoire: 'NC', devise: 'XPF' }

  it('porte l’instantané de la facture et la devise figée de la vente manuelle', () => {
    const items = [
      { id: 1, source: 'Facture', montant: 100 },
      { id: 2, source: 'VenteManuelle', montant: 30 },
      { id: 3, source: 'VenteManuelle', montant: 12 },
      { id: 4, source: 'VenteProduit', montant: 8 },
    ]
    const projetes = projeterDevisesImpayees(items, {
      factures: [{ id: 1, emetteurSnapshot: xpf }],
      ventesManuelles: [{ id: 2, monnaie: null }, { id: 3 }],
    })
    expect(projetes[0]).toEqual({ id: 1, source: 'Facture', montant: 100, emetteurSnapshot: xpf })
    // null = devise historique inconnue : conservé, jamais remplacé par la devise courante.
    expect(projetes[1]).toEqual({ id: 2, source: 'VenteManuelle', montant: 30, monnaie: null })
    // Sans devise figée projetée : pas de `monnaie`, la devise courante s'appliquera.
    expect('monnaie' in projetes[2]).toBe(false)
    expect(projetes[3]).toBe(items[3])
  })

  it('n’écrase pas ce que construireImpayees a déjà projeté', () => {
    const items = [
      { id: 1, source: 'Facture', montant: 100, emetteurSnapshot: { devise: 'EUR' } },
      { id: 2, source: 'VenteManuelle', montant: 30, monnaie: 'EUR' as const },
    ]
    const projetes = projeterDevisesImpayees(items, {
      factures: [{ id: 1, emetteurSnapshot: xpf }],
      ventesManuelles: [{ id: 2, monnaie: 'XPF' }],
    })
    expect(projetes).toEqual(items)
  })

  it('la ventilation sépare les devises sans conversion', () => {
    const projetes = projeterDevisesImpayees(
      [
        { id: 1, source: 'Facture', montant: 100 },
        { id: 2, source: 'VenteManuelle', montant: 30.1 },
        { id: 3, source: 'VenteProduit', montant: 8.2 },
        { id: 4, source: 'VenteManuelle', montant: 5 },
      ],
      { factures: [{ id: 1, emetteurSnapshot: xpf }], ventesManuelles: [{ id: 2, monnaie: 'EUR' }, { id: 4, monnaie: null }] },
    )
    expect(ventilerImpayeesParDevise(projetes, 'EUR')).toEqual([
      { monnaie: 'XPF', montant: 100 },
      { monnaie: 'EUR', montant: 38.3 },
      { monnaie: '', montant: 5 },
    ])
  })

  it('sans impayé, un total nul dans la devise courante', () => {
    expect(ventilerImpayeesParDevise([], 'XPF')).toEqual([{ monnaie: 'XPF', montant: 0 }])
  })
})
