import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ default: {} }))

import { purgerDonneesExpirees } from '@/lib/retention'

describe('purgerDonneesExpirees — durées de /confidentialite (revue du 2026-11-04)', () => {
  it('purge les connexions de plus de 12 mois et les consentements de plus de 13 mois', async () => {
    const db = {
      loginLog: { deleteMany: vi.fn(async () => ({ count: 4 })) },
      cookieConsent: { deleteMany: vi.fn(async () => ({ count: 1 })) },
    }
    const res = await purgerDonneesExpirees(new Date(2026, 10, 4, 3, 27), db as never)
    expect(db.loginLog.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date(2025, 10, 4, 3, 27) } } })
    expect(db.cookieConsent.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date(2025, 9, 4, 3, 27) } } })
    expect(res).toEqual({ connexions: 4, consentements: 1 })
  })
})
