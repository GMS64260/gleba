import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  default: { lotAnimaux: { findFirst } },
}))

import { isAssignableAnimalLot } from '../animal-lot'

describe('isAssignableAnimalLot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepte un lot actif du même utilisateur et de la même espèce de base', async () => {
    findFirst.mockResolvedValue({ id: 42, especeAnimaleId: 'chevre_alpine_chamoisee' })

    await expect(isAssignableAnimalLot('user-1', 42, 'chevre_laitiere')).resolves.toBe(true)
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 42, userId: 'user-1', statut: 'actif' },
      select: { id: true, especeAnimaleId: true },
    })
  })

  it('refuse un lot actif d’une autre espèce de base', async () => {
    findFirst.mockResolvedValue({ id: 42, especeAnimaleId: 'brebis_solognote' })

    await expect(isAssignableAnimalLot('user-1', 42, 'chevre_laitiere')).resolves.toBe(false)
  })

  it('refuse sans distinction un lot inexistant, tiers ou terminé', async () => {
    findFirst.mockResolvedValue(null)

    await expect(isAssignableAnimalLot('user-1', 42, 'ovin')).resolves.toBe(false)
  })

  it.each([0, -1, 1.5, 'abc', null])('refuse un identifiant invalide (%s) sans requête', async (lotId) => {
    await expect(isAssignableAnimalLot('user-1', lotId, 'ovin')).resolves.toBe(false)
    expect(findFirst).not.toHaveBeenCalled()
  })
})
