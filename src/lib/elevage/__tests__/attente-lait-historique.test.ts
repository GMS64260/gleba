import { describe, expect, it, vi } from 'vitest'
import { resyncEcartementLait, soinCouvrantCollecte } from '../attente-lait'

describe('attente lait avec historique animal–lot', () => {
  it('utilise le lot à la date de collecte, pas le lot courant', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const db = {
      collecteLait: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'collecte-1', date: new Date('2026-01-05T00:00:00Z'),
          animalId: 7, lotId: null, ecarteAttente: false,
        }]),
        updateMany,
      },
      soinAnimal: {
        findMany: vi.fn().mockResolvedValue([{
          date: new Date('2026-01-01T12:00:00Z'),
          finAttenteLait: new Date('2026-01-07T00:00:00Z'),
          animalId: null, lotId: 1,
        }]),
      },
      animal: {
        // L'animal est maintenant dans le lot 2 : cette valeur ne doit pas
        // écraser son appartenance historique au lot 1 le 5 janvier.
        findMany: vi.fn().mockResolvedValue([{ id: 7, lotId: 2 }]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{
        animalId: 7, lotId: 1,
        dateDebut: new Date('2025-12-01T00:00:00Z'),
        dateFin: new Date('2026-01-10T00:00:00Z'),
      }]),
    }

    await resyncEcartementLait(
      db as never,
      'user-1',
      { animalIds: [7], lotIds: [1] },
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-07T00:00:00Z')
    )

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['collecte-1'] } },
      data: { ecarteAttente: true },
    })
  })

  it('conserve l’attente d’un soin de lot après le départ de l’animal', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const db = {
      collecteLait: { findMany: vi.fn().mockResolvedValue([{ id: 'c2', date: new Date('2026-01-05T00:00:00Z'), animalId: 8, lotId: null, ecarteAttente: false }]), updateMany },
      soinAnimal: { findMany: vi.fn().mockResolvedValue([{ date: new Date('2026-01-01T12:00:00Z'), finAttenteLait: new Date('2026-01-07T00:00:00Z'), animalId: null, lotId: 1 }]) },
      animal: { findMany: vi.fn().mockResolvedValue([{ id: 8, lotId: 2 }]) },
      $queryRaw: vi.fn().mockResolvedValue([
        { animalId: 8, lotId: 2, dateDebut: new Date('2026-01-03T00:00:00Z'), dateFin: null },
        { animalId: 8, lotId: 1, dateDebut: new Date('2025-12-01T00:00:00Z'), dateFin: new Date('2026-01-03T00:00:00Z') },
      ]),
    }
    await resyncEcartementLait(db as never, 'user-1', { animalIds: [8], lotIds: [1, 2] }, new Date('2026-01-01'), new Date('2026-01-07'))
    expect(updateMany).toHaveBeenCalledWith({ where: { id: { in: ['c2'] } }, data: { ecarteAttente: true } })
  })
})

/** Base simulée de `soinCouvrantCollecte` : soins, lots courants, historique. */
function baseCouverture(
  soins: { date: Date; finAttenteLait: Date; animalId: number | null; lotId: number | null }[],
  historique: { animalId: number; lotId: number; dateDebut: Date; dateFin: Date | null }[],
  lotsCourants: { id: number; lotId: number | null }[] = [],
) {
  return {
    soinAnimal: { findMany: vi.fn().mockResolvedValue(soins.map((s) => ({ ...s, produit: 'Antibiotique', type: 'traitement' }))) },
    animal: { findMany: vi.fn().mockResolvedValue(lotsCourants) },
    $queryRaw: vi.fn().mockResolvedValue(historique),
  }
}
const j = (jour: string) => new Date(`${jour}T00:00:00Z`)

describe('attente lait : appartenance lue hors de la fenêtre de la collecte', () => {
  const soinLot1 = { date: new Date('2026-01-01T12:00:00Z'), finAttenteLait: j('2026-01-07'), animalId: null, lotId: 1 }
  const animal8 = [
    { animalId: 8, lotId: 2, dateDebut: j('2026-01-03'), dateFin: null },
    { animalId: 8, lotId: 1, dateDebut: j('2025-12-01'), dateFin: j('2026-01-03') },
  ]

  it('l’historique est lu sans borne de date : la ligne du lot quitté avant la collecte reste lisible', async () => {
    const db = baseCouverture([soinLot1], animal8, [{ id: 8, lotId: 2 }])
    const couvrant = await soinCouvrantCollecte(db as never, 'user-1', 8, null, j('2026-01-05'))
    expect(couvrant).not.toBeNull()
    for (const [requete] of db.$queryRaw.mock.calls) {
      const sql = (requete as { sql: string }).sql
      expect(sql).not.toContain('"date_fin" >')
      expect(sql).not.toContain('"date_debut" <')
    }
  })

  it('soin individuel : le tank du lot où se trouve l’animal le jour de la collecte est écarté, pas celui du lot quitté', async () => {
    const soin = { date: new Date('2026-01-01T12:00:00Z'), finAttenteLait: j('2026-01-07'), animalId: 8, lotId: null }
    const db = baseCouverture([soin], animal8, [{ id: 8, lotId: 2 }])
    expect(await soinCouvrantCollecte(db as never, 'user-1', null, 2, j('2026-01-05'))).not.toBeNull()
    expect(await soinCouvrantCollecte(db as never, 'user-1', null, 1, j('2026-01-05'))).toBeNull()
    // Le jour du départ, l'animal a pu être trait dans les deux lots.
    expect(await soinCouvrantCollecte(db as never, 'user-1', null, 1, j('2026-01-02'))).not.toBeNull()
  })

  it('soin de lot : l’animal traité puis déplacé fait écarter le tank du lot d’arrivée', async () => {
    const db = baseCouverture([soinLot1], animal8, [])
    expect(await soinCouvrantCollecte(db as never, 'user-1', null, 2, j('2026-01-05'))).not.toBeNull()
    // Avant son arrivée, le lot 2 n'est pas concerné.
    expect(await soinCouvrantCollecte(db as never, 'user-1', null, 2, j('2026-01-02'))).toBeNull()
  })

  it('un animal arrivé dans le lot après le soin ne fait écarter aucun autre tank', async () => {
    const arriveApres = [
      { animalId: 9, lotId: 3, dateDebut: j('2026-01-04'), dateFin: null },
      { animalId: 9, lotId: 1, dateDebut: j('2026-01-02'), dateFin: j('2026-01-04') },
    ]
    const db = baseCouverture([soinLot1], arriveApres, [])
    expect(await soinCouvrantCollecte(db as never, 'user-1', null, 3, j('2026-01-05'))).toBeNull()
  })
})

describe('attente lait : fenêtre au jour civil', () => {
  // Dates construites en heure locale : le 2 à 00:30 est du 2 quel que soit le
  // fuseau du processus (à Paris, il est stocké le 1er à 23:30 UTC).
  const soin = { date: new Date(2026, 0, 2, 0, 30), finAttenteLait: new Date(2026, 0, 9, 0, 30), animalId: 5, lotId: null }

  it('une injection de 00:30 n’écarte pas le lait de la veille', async () => {
    const db = baseCouverture([soin], [], [{ id: 5, lotId: null }])
    expect(await soinCouvrantCollecte(db as never, 'user-1', 5, null, j('2026-01-01'))).toBeNull()
    expect(await soinCouvrantCollecte(db as never, 'user-1', 5, null, j('2026-01-02'))).not.toBeNull()
  })

  it('le dernier jour d’attente reste écarté, le lendemain est libre', async () => {
    const db = baseCouverture([soin], [], [{ id: 5, lotId: null }])
    expect(await soinCouvrantCollecte(db as never, 'user-1', 5, null, j('2026-01-09'))).not.toBeNull()
    expect(await soinCouvrantCollecte(db as never, 'user-1', 5, null, j('2026-01-10'))).toBeNull()
  })
})
