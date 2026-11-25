import { describe, expect, it, vi } from 'vitest'
import { cederLaLignee, cleLignee, compterLignees, compterRecoltesSaisies } from '../lignee'

describe('lignée des lots de récolte', () => {
  it('une récolte saisie est sa propre lignée, une part pointe la sienne', () => {
    expect(cleLignee({ id: 10, recolteOrigineId: null })).toBe(10)
    expect(cleLignee({ id: 11, recolteOrigineId: 10 })).toBe(10)
    expect(cleLignee({ id: 12 })).toBe(12)
  })

  it('compte les récoltes saisies, pas les lignes', () => {
    // 10 kg dont 1 kg perdu puis 2 kg donnés : trois lignes, une récolte ; plus une autre récolte.
    expect(compterLignees([
      { id: 10, recolteOrigineId: null }, { id: 11, recolteOrigineId: 10 }, { id: 12, recolteOrigineId: 10 },
      { id: 20, recolteOrigineId: null },
    ])).toBe(2)
    expect(compterLignees([])).toBe(0)
  })

  it('ne vaut jamais 0 quand des lignes existent : une part dont la racine est ailleurs compte', () => {
    expect(compterLignees([{ id: 11, recolteOrigineId: 10 }])).toBe(1)
  })

  it('lit les lignes de la culture du compte', async () => {
    const findMany = vi.fn(async () => [{ id: 1, recolteOrigineId: null }, { id: 2, recolteOrigineId: 1 }])
    expect(await compterRecoltesSaisies({ recolte: { findMany } }, 7, 'u1')).toBe(1)
    expect(findMany).toHaveBeenCalledWith({ where: { cultureId: 7, userId: 'u1' }, select: { id: true, recolteOrigineId: true } })
  })
})

describe('cederLaLignee', () => {
  const client = (parts: Array<{ id: number }>) => {
    const recolte = { findMany: vi.fn(async () => parts), updateMany: vi.fn(async () => ({ count: 1 })) }
    return { recolte, tx: { recolte } as never }
  }

  it('sans part, n’écrit rien', async () => {
    const { recolte, tx } = client([])
    expect(await cederLaLignee(tx, 'u1', 10)).toBe(0)
    expect(recolte.updateMany).not.toHaveBeenCalled()
  })

  it('une seule part redevient une récolte saisie', async () => {
    const { recolte, tx } = client([{ id: 11 }])
    expect(await cederLaLignee(tx, 'u1', 10)).toBe(1)
    expect(recolte.updateMany.mock.calls.map(([appel]) => appel)).toEqual([{ where: { userId: 'u1', id: 11 }, data: { recolteOrigineId: null } }])
  })

  it('la part la plus ancienne hérite des autres', async () => {
    const { recolte, tx } = client([{ id: 11 }, { id: 12 }, { id: 13 }])
    expect(await cederLaLignee(tx, 'u1', 10)).toBe(3)
    expect(recolte.findMany).toHaveBeenCalledWith({ where: { userId: 'u1', recolteOrigineId: 10 }, orderBy: { id: 'asc' }, select: { id: true } })
    expect(recolte.updateMany.mock.calls.map(([appel]) => appel)).toEqual([
      { where: { userId: 'u1', recolteOrigineId: 10, id: { not: 11 } }, data: { recolteOrigineId: 11 } },
      { where: { userId: 'u1', id: 11 }, data: { recolteOrigineId: null } },
    ])
  })
})
