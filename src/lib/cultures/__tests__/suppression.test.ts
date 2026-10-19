import { describe, expect, it, vi } from 'vitest'
import {
  aDesVentes,
  compterVentesRecoltesCulture,
  messageSuppressionCultureRefusee,
} from '@/lib/cultures/suppression'

function baseFactice(
  recoltes: Array<{ id: number; statut: string; factureId: number | null }>,
  ventes: Array<{ sourceId: number }>
) {
  return {
    recolte: { findMany: vi.fn().mockResolvedValue(recoltes) },
    venteManuelle: { findMany: vi.fn().mockResolvedValue(ventes) },
  }
}

describe('compterVentesRecoltesCulture', () => {
  it('une culture sans récolte n’a aucune vente, sans lire la comptabilité', async () => {
    const db = baseFactice([], [])
    const ventes = await compterVentesRecoltesCulture(db as never, 42, 'user-1')

    expect(ventes).toEqual({ recoltes: 0, recoltesVendues: 0, ventes: 0, factures: 0 })
    expect(aDesVentes(ventes)).toBe(false)
    expect(db.venteManuelle.findMany).not.toHaveBeenCalled()
  })

  it('des récoltes en stock, consommées ou perdues ne retiennent pas la culture', async () => {
    const db = baseFactice(
      [
        { id: 1, statut: 'en_stock', factureId: null },
        { id: 2, statut: 'consomme', factureId: null },
        { id: 3, statut: 'perte', factureId: null },
      ],
      []
    )
    const ventes = await compterVentesRecoltesCulture(db as never, 42, 'user-1')

    expect(ventes.recoltes).toBe(3)
    expect(aDesVentes(ventes)).toBe(false)
  })

  it('vendue = statut vendu, facture ou écriture de vente, chacune comptée une fois', async () => {
    const db = baseFactice(
      [
        { id: 1, statut: 'vendu', factureId: null }, // vente auto
        { id: 2, statut: 'vendu', factureId: 9 }, // facturée, sans écriture auto
        { id: 3, statut: 'en_stock', factureId: null }, // écriture orpheline d'une ancienne vente
        { id: 4, statut: 'en_stock', factureId: null },
      ],
      [{ sourceId: 1 }, { sourceId: 3 }]
    )
    const ventes = await compterVentesRecoltesCulture(db as never, 42, 'user-1')

    expect(ventes).toEqual({ recoltes: 4, recoltesVendues: 3, ventes: 2, factures: 1 })
    expect(aDesVentes(ventes)).toBe(true)
    expect(db.recolte.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cultureId: 42, userId: 'user-1' },
    }))
    expect(db.venteManuelle.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', sourceType: 'recolte', sourceId: { in: [1, 2, 3, 4] } },
    }))
  })
})

describe('messageSuppressionCultureRefusee', () => {
  it('nomme les récoltes et les ventes, et renvoie vers la suppression des ventes d’abord', () => {
    expect(
      messageSuppressionCultureRefusee(
        { id: 42, especeId: 'Tomate' },
        { recoltes: 5, recoltesVendues: 2, ventes: 2, factures: 1 }
      )
    ).toBe(
      "La culture #42 (Tomate) a 2 récoltes vendues sur 5 (2 ventes en comptabilité et 1 facture) : la supprimer effacerait ces ventes de la comptabilité. " +
        "Supprimez d'abord les ventes : dans Maraîchage > Récoltes, supprimer une récolte vendue retire sa vente (une facture payée demande d'abord un avoir). " +
        'Supprimez ensuite la culture.'
    )
  })

  it('au singulier, sans détail quand la vente n’a pas d’écriture', () => {
    const message = messageSuppressionCultureRefusee(
      { id: 7, especeId: 'Courge' },
      { recoltes: 1, recoltesVendues: 1, ventes: 0, factures: 0 }
    )
    expect(message).toContain('a 1 récolte vendue : la supprimer')
    expect(message).not.toContain('—')
  })
})
