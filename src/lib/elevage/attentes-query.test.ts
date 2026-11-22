import { describe, expect, it, vi } from 'vitest'

const findMany = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({ default: { soinAnimal: { findMany } } }))

import { chargerAttentesConsolidees } from './attentes-query'

// Ticket cmulnl0wk (2026-09-28) : « supprimer le délai lait d’une chèvre morte ».
describe('délais d’attente des animaux sortis', () => {
  it('ne charge que les soins de lot ou d’animaux encore actifs', async () => {
    findMany.mockResolvedValue([])
    await chargerAttentesConsolidees('u', new Date('2026-10-02T00:00:00Z'))
    const where = findMany.mock.calls[0][0].where
    expect(where.AND).toEqual([{ OR: [{ animalId: null }, { animal: { statut: 'actif' } }] }])
  })

  // FB-J1F5VX : sans les injections saisies, la remise en vente du tableau de
  // bord repartait du calendrier théorique du protocole.
  it('charge les injections saisies et fait courir le délai depuis la dernière', async () => {
    findMany.mockResolvedValue([{
      id: 1, animalId: 7, lotId: null, type: 'Traitement', produit: 'Produit fictif', produitId: null,
      date: new Date('2026-11-10T00:00:00Z'), datePrevue: null, fait: true,
      tempsAttenteLaitJ: 7, tempsAttenteViandeJ: 0, tempsAttenteOeufsJ: 0,
      nbInjections: 3, intervalleInjectionsHeures: 24,
      injections: [
        { numero: 1, datePrevue: new Date('2026-11-10T00:00:00Z'), dateRealisee: new Date('2026-11-10T00:00:00Z'), statut: 'realisee' },
        { numero: 3, datePrevue: new Date('2026-11-12T00:00:00Z'), dateRealisee: new Date('2026-11-14T00:00:00Z'), statut: 'realisee' },
      ],
      animal: { id: 7, nom: 'Animal fictif', identifiant: null }, lot: null, produitVeterinaire: null,
    }])
    const [attente] = await chargerAttentesConsolidees('u', new Date('2026-11-15T00:00:00Z'))
    expect(findMany.mock.calls.at(-1)![0].select.injections).toEqual(
      { select: { numero: true, datePrevue: true, dateRealisee: true, statut: true } })
    expect(attente.finAttenteLait?.toISOString()).toBe('2026-11-21T00:00:00.000Z')
  })
})
