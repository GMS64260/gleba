import { describe, expect, it, vi } from 'vitest'
import { refusRemiseActif } from './sortie-animal.server'

const db = (vente: object | null, abattage: object | null) => ({
  venteProduit: { findFirst: vi.fn().mockResolvedValue(vente) },
  abattage: { findFirst: vi.fn().mockResolvedValue(abattage) },
}) as unknown as Parameters<typeof refusRemiseActif>[0]

describe('refusRemiseActif', () => {
  it('laisse réactiver une fiche sans vente ni abattage actif', async () => {
    expect(await refusRemiseActif(db(null, null), 'u1', 7)).toBeNull()
  })

  it('refuse tant qu’une vente ou un abattage non annulé vise l’animal, en bornant par propriétaire', async () => {
    const avecVente = db({ id: 3 }, null)
    expect(await refusRemiseActif(avecVente, 'u1', 7)).toContain('annulez la vente')
    expect(avecVente.venteProduit.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1', animalId: 7, type: 'animal_vivant', annule: { not: true } },
    }))
    expect(await refusRemiseActif(db(null, { id: 4 }), 'u1', 7)).toContain('annulez l’abattage')
  })
})
