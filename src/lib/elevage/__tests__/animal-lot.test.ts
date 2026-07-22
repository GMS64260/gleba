import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  default: { lotAnimaux: { findFirst } },
}))

import { isAssignableAnimalLot } from '../animal-lot'

describe('isAssignableAnimalLot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepte uniquement un lot actif du même utilisateur et de la même espèce', async () => {
    findFirst.mockResolvedValue({ id: 42 })

    await expect(isAssignableAnimalLot('user-1', 42, 'ovin')).resolves.toBe(true)
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 42, userId: 'user-1', statut: 'actif', especeAnimaleId: 'ovin' },
      select: { id: true },
    })
  })

  it('refuse sans distinction un lot inexistant, tiers, terminé ou d’une autre espèce', async () => {
    findFirst.mockResolvedValue(null)

    await expect(isAssignableAnimalLot('user-1', 42, 'ovin')).resolves.toBe(false)
  })

  it.each([0, -1, 1.5, 'abc', null])('refuse un identifiant invalide (%s) sans requête', async (lotId) => {
    await expect(isAssignableAnimalLot('user-1', lotId, 'ovin')).resolves.toBe(false)
    expect(findFirst).not.toHaveBeenCalled()
  })
})
