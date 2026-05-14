import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearKpiCache, invalidateKpi, memoize } from '../cache'

describe('cache KPI', () => {
  beforeEach(() => {
    clearKpiCache()
  })

  it('mémoïse une valeur sur la même clé', async () => {
    const compute = vi.fn(async () => 42)
    const a = await memoize('k1', compute)
    const b = await memoize('k1', compute)
    expect(a).toBe(42)
    expect(b).toBe(42)
    expect(compute).toHaveBeenCalledTimes(1)
  })

  it('invalideKpi(userId) supprime toutes les entrées de cet utilisateur', async () => {
    const compute = vi.fn(async () => 1)
    await memoize('maraichage:user-A:2026:2026-5-14', compute)
    await memoize('compta:user-A:2026:2026-5-14', compute)
    await memoize('compta:user-B:2026:2026-5-14', compute)
    expect(compute).toHaveBeenCalledTimes(3)

    invalidateKpi('user-A')

    await memoize('maraichage:user-A:2026:2026-5-14', compute)
    await memoize('compta:user-A:2026:2026-5-14', compute)
    // user-A : 2 nouvelles invocations
    // user-B : pas touché
    await memoize('compta:user-B:2026:2026-5-14', compute)
    expect(compute).toHaveBeenCalledTimes(5)
  })
})
