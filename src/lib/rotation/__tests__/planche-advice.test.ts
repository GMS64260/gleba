import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Revue du 2026-11-11 — l'espèce à vérifier était lue par son seul identifiant :
 * avec l'identifiant de l'espèce privée d'un autre compte, le conseil se
 * calculait sur sa famille et son besoin en azote. Elle est lue sous la règle
 * de visibilité du référentiel, comme à la création d'une culture.
 */
const mocks = vi.hoisted(() => ({
  plancheFindUnique: vi.fn(),
  cultureFindMany: vi.fn(),
  familleFindMany: vi.fn(),
  especeFindFirst: vi.fn(),
  especeFindUnique: vi.fn(),
  checkRotationViolation: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    planche: { findUnique: mocks.plancheFindUnique },
    culture: { findMany: mocks.cultureFindMany },
    famille: { findMany: mocks.familleFindMany },
    espece: { findFirst: mocks.especeFindFirst, findUnique: mocks.especeFindUnique },
  },
}))
vi.mock('@/lib/planches/resolution', () => ({ resoudreIdPlanche: vi.fn().mockResolvedValue('planche-1') }))
vi.mock('@/lib/rotation-check', () => ({ checkRotationViolation: mocks.checkRotationViolation }))

import { conseilRotationPlanche } from '../planche-advice'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.plancheFindUnique.mockResolvedValue({ id: 'planche-1', nom: 'A1' })
  mocks.cultureFindMany.mockResolvedValue([])
  mocks.familleFindMany.mockResolvedValue([])
  mocks.checkRotationViolation.mockResolvedValue(null)
})

describe('conseilRotationPlanche — espèce à vérifier', () => {
  it("lit l'espèce sous la règle de visibilité du référentiel", async () => {
    mocks.especeFindFirst.mockResolvedValue({ id: 'Tomate', familleId: 'Solanaceae', besoinN: 4 })
    const conseil = await conseilRotationPlanche('planche-1', 'exploitation-1', 2027, 'Tomate')
    expect(mocks.especeFindUnique).not.toHaveBeenCalled()
    expect(mocks.especeFindFirst.mock.calls[0][0].where).toEqual({
      AND: [
        { id: 'Tomate' },
        { OR: [{ userId: null }, { partageCommunaute: true }, { userId: 'exploitation-1' }] },
      ],
    })
    expect(mocks.checkRotationViolation).toHaveBeenCalledWith('planche-1', 'Tomate', 2027, 'exploitation-1')
    expect(conseil?.advice.planRotation).toEqual({ conforme: true })
  })

  it("ne dit rien d'une espèce que le compte ne voit pas", async () => {
    mocks.especeFindFirst.mockResolvedValue(null)
    mocks.especeFindUnique.mockResolvedValue({ id: 'espece-privee', familleId: 'Solanaceae', besoinN: 4 })
    const conseil = await conseilRotationPlanche('planche-1', 'exploitation-1', 2027, 'espece-privee')
    expect(conseil).not.toBeNull()
    expect(mocks.checkRotationViolation).not.toHaveBeenCalled()
    expect(conseil?.advice.planRotation).toBeUndefined()
  })
})
