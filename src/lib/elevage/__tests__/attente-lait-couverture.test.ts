import { describe, expect, it, vi } from 'vitest'
import { soinCouvrantCollecte } from '../attente-lait'

/**
 * Ticket cms1v9rj5 — repro QA : vermifuge Cydectine 0.1% Oral enregistré le
 * 26/07 sur la chèvre Myrtille (fin d'attente lait 02/08), puis saisie d'une
 * traite du SOIR le 26/07 (les collectes sont stockées au jour, 00:00 UTC,
 * quelle que soit la traite) → la collecte doit être couverte (écartée).
 */

const ANIMAL_MYRTILLE = 282

function dbAvecSoins(soins: unknown[]) {
  return {
    soinAnimal: { findMany: vi.fn().mockResolvedValue(soins) },
    animal: { findMany: vi.fn().mockResolvedValue([{ id: ANIMAL_MYRTILLE, lotId: null }]) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  }
}

const soinCydectine = {
  date: new Date('2026-07-26T00:00:00Z'), // soin saisi au jour (formulaire date)
  finAttenteLait: new Date('2026-08-02T00:00:00Z'), // 7 j d'attente lait
  animalId: ANIMAL_MYRTILLE,
  lotId: null,
  produit: 'Cydectine 0.1% Oral',
  type: 'Vermifuge',
}

describe('soinCouvrantCollecte — cas du ticket cms1v9rj5', () => {
  it('couvre la traite du soir saisie le jour J du soin (26/07)', async () => {
    const db = dbAvecSoins([soinCydectine])
    const r = await soinCouvrantCollecte(db as never, 'admin', ANIMAL_MYRTILLE, null, new Date('2026-07-26T00:00:00Z'))
    expect(r).not.toBeNull()
    expect(r?.produit).toBe('Cydectine 0.1% Oral')
    expect(r?.finAttenteLait?.toISOString()).toBe('2026-08-02T00:00:00.000Z')
  })

  it('couvre aussi quand le soin est horodaté en journée (comparaison au jour)', async () => {
    const db = dbAvecSoins([{ ...soinCydectine, date: new Date('2026-07-26T13:53:46Z') }])
    const r = await soinCouvrantCollecte(db as never, 'admin', ANIMAL_MYRTILLE, null, new Date('2026-07-26T00:00:00Z'))
    expect(r).not.toBeNull()
  })

  it("couvre le dernier jour d'attente (02/08) et libère le lendemain (03/08)", async () => {
    const dernierJour = await soinCouvrantCollecte(
      dbAvecSoins([soinCydectine]) as never, 'admin', ANIMAL_MYRTILLE, null, new Date('2026-08-02T00:00:00Z')
    )
    expect(dernierJour).not.toBeNull()

    const lendemain = await soinCouvrantCollecte(
      dbAvecSoins([soinCydectine]) as never, 'admin', ANIMAL_MYRTILLE, null, new Date('2026-08-03T00:00:00Z')
    )
    expect(lendemain).toBeNull()
  })

  it('ne couvre pas la collecte d’un autre animal', async () => {
    const db = dbAvecSoins([soinCydectine])
    const r = await soinCouvrantCollecte(db as never, 'admin', 264, null, new Date('2026-07-26T00:00:00Z'))
    expect(r).toBeNull()
  })

  it('ignore un soin sans fin d’attente lait (ex. parage le même jour)', async () => {
    const parage = { date: new Date('2026-07-26T00:00:00Z'), finAttenteLait: null, animalId: ANIMAL_MYRTILLE, lotId: null, produit: null, type: 'Parage onglons' }
    const db = dbAvecSoins([parage])
    const r = await soinCouvrantCollecte(db as never, 'admin', ANIMAL_MYRTILLE, null, new Date('2026-07-26T00:00:00Z'))
    expect(r).toBeNull()
  })
})
