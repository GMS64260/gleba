import { describe, expect, it } from 'vitest'
import { construireImpayees } from '../impayees'

describe('créance d’une vente d’élevage', () => {
  it('un avoir brouillon ne réduit pas encore la créance', () => {
    const result = construireImpayees({ factures: [
      { id: 1, date: '2026-10-27', type: 'facture', statut: 'emise', totalTTC: 12 },
      { id: 2, date: '2026-10-27', type: 'avoir', statut: 'brouillon', totalTTC: 12, factureOrigineId: 1 },
    ] })
    expect(result.total).toBe(12)
  })
  it('un avoir soldant la facture ne fait pas réapparaître sa vente source', () => {
    const result = construireImpayees({
      factures: [
        { id: 1, date: '2026-10-27', type: 'facture', statut: 'emise', totalTTC: 12 },
        { id: 2, date: '2026-10-27', type: 'avoir', statut: 'emise', totalTTC: 12, factureOrigineId: 1 },
      ],
      ventes: [{ id: 3, date: '2026-10-27', type: 'oeufs', prixTotal: 12, factureId: 1 }],
    })
    expect(result.total).toBe(0)
    expect(result.items).toEqual([])
  })
  it('compte la vente une seule fois, même si son miroir est renvoyé par l’API', () => {
    const commun = { date: '2026-10-27', description: 'Œufs QA' }
    const result = construireImpayees({
      ventes: [{ ...commun, id: 1, type: 'oeufs', prixTotal: 12 }],
      ventesManuelles: [
        { ...commun, id: 2, categorie: 'oeufs', montant: 12, auto: true, sourceType: 'vente_produit' },
        { ...commun, id: 3, categorie: 'autre', montant: 5, auto: true, sourceType: 'commande_boutique' },
      ],
    })
    expect(result.total).toBe(17)
    expect(result.items.map((i) => i.source)).toEqual(['VenteProduit', 'VenteManuelle'])
  })
})
