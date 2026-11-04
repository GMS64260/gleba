import { describe, expect, it, vi } from 'vitest'

import { supprimerDonneesSansCleEtrangere } from '@/lib/account-lifecycle'

/**
 * Revue du 2026-11-04 — neuf tables d'élevage et les aliments privés portent
 * le compte sans clé étrangère : la cascade de `users` ne les atteint pas.
 */
describe('supprimerDonneesSansCleEtrangere', () => {
  it('vide les neuf tables par user_id, et les aliments privés que rien ne référence', async () => {
    const modeles = [
      'pesee', 'reservationElevage', 'testSanteElevage', 'pedigreeElevage', 'planRation',
      'prophylaxieElevage', 'realisationTacheElevage', 'tacheTerrainElevage', 'historiqueLotAnimal',
    ]
    const tx: Record<string, { deleteMany: ReturnType<typeof vi.fn> }> = {}
    for (const m of [...modeles, 'aliment']) tx[m] = { deleteMany: vi.fn(async () => ({ count: 1 })) }

    const total = await supprimerDonneesSansCleEtrangere(tx as never, 'compte-a')

    for (const m of modeles) expect(tx[m].deleteMany).toHaveBeenCalledWith({ where: { userId: 'compte-a' } })
    expect(tx.aliment.deleteMany).toHaveBeenCalledWith({
      where: { ownerUserId: 'compte-a', consommations: { none: {} } },
    })
    expect(total).toBe(10)
  })
})
