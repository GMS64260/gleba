import { describe, expect, it } from 'vitest'
import { cibleReglementLigne } from '../cle-reglement'

describe('pièce à régler depuis une transaction', () => {
  it('adresse la vente native et non la clé primaire distincte de son miroir', () => {
    const vente = { source: 'VenteProduit', sourceId: 167, ecriture: { id: 909 } }
    expect(cibleReglementLigne(vente, 'vente')).toEqual({ type: 'VenteProduit', id: 167 })
    expect(cibleReglementLigne({ ...vente, facture: { id: 42 } }, 'vente')).toEqual({ type: 'Facture', id: 42 })
  })
  it('adresse le miroir pour une dépense dérivée et conserve les exclusions métier', () => {
    const lot = { source: 'LotAnimaux', sourceId: 17, ecriture: { id: 290 } }
    expect(cibleReglementLigne(lot, 'depense')).toEqual({ type: 'DepenseManuelle', id: 290 })
    expect(cibleReglementLigne({ ...lot, comptable: false }, 'depense')).toBeNull()
    expect(cibleReglementLigne({ ...lot, reglementsDisponibles: false }, 'depense')).toBeNull()
  })
})
