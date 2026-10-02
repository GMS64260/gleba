import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  soinFindFirst: vi.fn(), soinUpdate: vi.fn(), queryRaw: vi.fn(), executeRaw: vi.fn(),
  resync: vi.fn(), cibles: vi.fn(),
}))

vi.mock('@/lib/prisma', () => {
  const tx = {
    soinAnimal: { update: mocks.soinUpdate },
    stockMedicamentElevage: { updateMany: vi.fn(), update: vi.fn() },
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
  }
  return { default: {
    soinAnimal: { findFirst: mocks.soinFindFirst },
    $queryRaw: mocks.queryRaw,
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  } }
})
vi.mock('./attente-lait', () => ({ ciblesAffectees: mocks.cibles, resyncEcartementLait: mocks.resync }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({ deleteAutoEntry: vi.fn() }))

import { daterInjection, mettreAJourProtocoleSoin, synchroniserInjections } from './injections-protocole'

const J = (iso: string) => new Date(iso)
const soinUbrolexin = {
  id: 233, userId: 'u', animalId: 7, lotId: null, date: J('2026-09-28T00:00:00Z'), datePrevue: null,
  fait: true, nbInjections: 4, intervalleInjectionsHeures: 12, tempsAttenteLaitJ: 5, tempsAttenteOeufsJ: null,
  tempsAttenteViandeJ: 10, finAttenteLait: J('2026-10-06T20:13:00Z'), finAttenteViande: null, finAttenteOeufs: null,
  stockMedicamentId: null, quantitePreleveeStock: 0, quantite: null, produit: 'ubrolexin',
}

describe('injections : calendrier et dates réelles (tickets vigie2cc83585 / cmupz9djj)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cibles.mockResolvedValue({ animalIds: [7], lotIds: [] })
    mocks.soinUpdate.mockImplementation(async ({ data }) => ({ ...soinUbrolexin, ...data }))
  })

  it('un changement de protocole recalcule date_prevue de toutes les injections et recale les réalisées', async () => {
    await synchroniserInjections({ $executeRaw: mocks.executeRaw } as never, 'u', 233,
      { debut: J('2026-07-10T00:00:00Z'), nombre: 4, intervalleHeures: 24 },
      { protocoleChange: true, marquerPremiereFaite: false, rouvrirPremiere: false, dateRealiseePremiere: new Date() })
    const inserts = mocks.executeRaw.mock.calls.filter(([s]) => (s as string[]).join('').includes('INSERT INTO injections_soins'))
    expect(inserts).toHaveLength(4)
    const sql = (inserts[0][0] as string[]).join('?')
    // Plus de conservation de date_prevue pour les injections réalisées.
    expect(sql).toContain('date_prevue = EXCLUDED.date_prevue')
    expect(sql).not.toContain("THEN injections_soins.date_prevue")
    expect(sql).toContain("injections_soins.statut = 'realisee' THEN EXCLUDED.date_prevue")
    const dates = inserts.map(([, ...v]) => v.find((x) => x instanceof Date) as Date)
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13'])
    for (const [, ...valeurs] of inserts) {
      expect(valeurs.every((v) => v === null || v instanceof Date || ['string', 'number', 'boolean'].includes(typeof v))).toBe(true)
      expect(valeurs.filter((v) => typeof v === 'boolean')).toContain(true)
    }
  })

  it('update_soin recale l’Ubrolexin au 10/07 à 24 h et ancre le délai sur la dernière injection', async () => {
    mocks.soinFindFirst.mockResolvedValue(soinUbrolexin)
    const apres = [1, 2, 3, 4].map((n) => ({
      id: `i${n}`, numero: n, statut: 'realisee',
      datePrevue: J(`2026-07-${String(9 + n).padStart(2, '0')}T00:00:00Z`),
      dateRealisee: J(`2026-07-${String(9 + n).padStart(2, '0')}T00:00:00Z`),
    }))
    mocks.queryRaw.mockResolvedValueOnce(apres).mockResolvedValueOnce(apres)
    const res = await mettreAJourProtocoleSoin('u', 233, { date: J('2026-07-10T00:00:00Z'), intervalleInjectionsHeures: 24 })
    expect(res.ok).toBe(true)
    const derniereMaj = mocks.soinUpdate.mock.calls.at(-1)![0].data
    expect(derniereMaj.finAttenteLait.toISOString().slice(0, 10)).toBe('2026-07-18')
    expect(derniereMaj.finAttenteViande.toISOString().slice(0, 10)).toBe('2026-07-23')
    const sql = mocks.executeRaw.mock.calls.filter(([s]) => (s as string[]).join('').includes('INSERT'))
    expect(sql).toHaveLength(4)
    expect(sql[0]).toContain(true) // protocoleChange
  })

  it('refuse plusieurs injections sans intervalle', async () => {
    mocks.soinFindFirst.mockResolvedValue({ ...soinUbrolexin, intervalleInjectionsHeures: null, nbInjections: 1 })
    const res = await mettreAJourProtocoleSoin('u', 233, { nbInjections: 3 })
    expect(res).toMatchObject({ ok: false, status: 400 })
  })

  it('redater la première injection déplace la date du soin et recale l’attente', async () => {
    mocks.soinFindFirst.mockResolvedValue(soinUbrolexin)
    const avant = [{ id: 'i1', numero: 1, statut: 'realisee', datePrevue: J('2026-09-28T00:00:00Z'), dateRealisee: J('2026-10-01T20:13:15Z') }]
    const apres = [{ ...avant[0], dateRealisee: J('2026-07-10T08:00:00Z') }]
    mocks.queryRaw.mockResolvedValueOnce(avant).mockResolvedValueOnce(apres)
    const res = await daterInjection('u', 233, { injectionId: 'i1', dateRealisee: J('2026-07-10T08:00:00Z') })
    expect(res.ok).toBe(true)
    const data = mocks.soinUpdate.mock.calls[0][0].data
    expect(data.date).toEqual(J('2026-07-10T08:00:00Z'))
    expect(data.datePrevue).toEqual(soinUbrolexin.date)
    expect(data.finAttenteLait.toISOString().slice(0, 10)).toBe('2026-07-15')
    expect(mocks.resync).toHaveBeenCalled()
  })

  it('une date réelle sur une injection non réalisée est refusée', async () => {
    mocks.soinFindFirst.mockResolvedValue(soinUbrolexin)
    mocks.queryRaw.mockResolvedValueOnce([{ id: 'i2', numero: 2, statut: 'a_faire', datePrevue: J('2026-07-11T00:00:00Z'), dateRealisee: null }])
    const res = await daterInjection('u', 233, { injectionId: 'i2', statut: 'a_faire', dateRealisee: J('2026-07-11T00:00:00Z') })
    expect(res).toMatchObject({ ok: false, status: 400 })
  })
})
