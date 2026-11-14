import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  soinFindFirst: vi.fn(), soinUpdate: vi.fn(), queryRaw: vi.fn(), executeRaw: vi.fn(),
  resync: vi.fn(), cibles: vi.fn(), annulationCreate: vi.fn(), stockUpdate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => {
  const tx = {
    soinAnimal: { update: mocks.soinUpdate, findFirst: mocks.soinFindFirst },
    stockMedicamentElevage: { updateMany: vi.fn(), update: mocks.stockUpdate, findFirst: vi.fn().mockResolvedValue({ quantite: 5, notes: null }) },
    annulationSoinAnimal: { create: mocks.annulationCreate },
    injectionSoin: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
  }
  return { default: {
    soinAnimal: { findFirst: mocks.soinFindFirst },
    $queryRaw: mocks.queryRaw,
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  } }
})
vi.mock('./attente-lait', () => ({ ciblesLaitAffectees: mocks.cibles, resyncEcartementLait: mocks.resync }))
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

  // Drapeau « les réalisées suivent le calendrier » (`calendrierChange`) =
  // valeur interpolée juste avant ce fragment du SQL de `synchroniserInjections`.
  const calendrierChange = (appel: unknown[]) => {
    const [strings, ...valeurs] = appel as [string[], ...unknown[]]
    const i = valeurs.findIndex((_, k) => strings[k + 1].startsWith("::boolean AND injections_soins.statut = 'realisee'"))
    expect(i).toBeGreaterThanOrEqual(0)
    return valeurs[i]
  }
  const insertions = () => mocks.executeRaw.mock.calls.filter(([s]) => (s as string[]).join('').includes('INSERT INTO injections_soins'))

  it('un changement de calendrier recalcule date_prevue de toutes les injections et recale les réalisées', async () => {
    await synchroniserInjections({ $executeRaw: mocks.executeRaw } as never, 'u', 233,
      { debut: J('2026-07-10T00:00:00Z'), nombre: 4, intervalleHeures: 24 },
      { calendrierChange: true, marquerPremiereFaite: false, rouvrirPremiere: false, dateRealiseePremiere: new Date() })
    const inserts = insertions()
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
    }
    expect(inserts.map(calendrierChange)).toEqual([true, true, true, true])
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
    expect(insertions().map(calendrierChange)).toEqual([true, true, true, true])
  })

  // Ticket cmvnp6s3z (2026-10-25), côté assistant (`update_soin` passe la
  // chaîne brute) : 1re injection datée 24/09 08:00 Paris (06:00 UTC).
  describe('update_soin et jour seul (ticket cmvnp6s3z)', () => {
    const soinDate08h = { ...soinUbrolexin, date: J('2026-09-24T06:00:00Z'), nbInjections: 2, intervalleInjectionsHeures: 48 }
    const injections08h = [
      { id: 'i1', numero: 1, statut: 'realisee', datePrevue: J('2026-09-24T06:00:00Z'), dateRealisee: J('2026-09-24T06:00:00Z') },
      { id: 'i2', numero: 2, statut: 'a_faire', datePrevue: J('2026-09-26T06:00:00Z'), dateRealisee: null },
    ]

    it('intervalle seul, même jour sans heure : la date du soin garde 08:00 et les faites suivent ce calendrier', async () => {
      mocks.soinFindFirst.mockResolvedValue(soinDate08h)
      mocks.queryRaw.mockResolvedValue(injections08h)
      const res = await mettreAJourProtocoleSoin('u', 233, { date: '2026-09-24', intervalleInjectionsHeures: 24 })
      expect(res.ok).toBe(true)
      expect(mocks.soinUpdate.mock.calls[0][0].data.date).toEqual(J('2026-09-24T06:00:00Z'))
      const inserts = insertions()
      expect(inserts.map(calendrierChange)).toEqual([true, true])
      // date_prevue (1) = 06:00 UTC : la date réelle recopiée reste 08:00 Paris.
      expect(inserts.map(([, ...v]) => (v.find((x) => x instanceof Date) as Date).toISOString()))
        .toEqual(['2026-09-24T06:00:00.000Z', '2026-09-25T06:00:00.000Z'])
    })

    it('autre jour : la série suit, à la même heure murale', async () => {
      mocks.soinFindFirst.mockResolvedValue(soinDate08h)
      mocks.queryRaw.mockResolvedValue(injections08h)
      const res = await mettreAJourProtocoleSoin('u', 233, { date: '2026-09-25' })
      expect(res.ok).toBe(true)
      expect(mocks.soinUpdate.mock.calls[0][0].data.date).toEqual(J('2026-09-25T06:00:00Z'))
      expect(insertions().map(calendrierChange)).toEqual([true, true])
    })

    it('rien ne change (même jour, même protocole) : les dates réelles ne sont pas recalées', async () => {
      mocks.soinFindFirst.mockResolvedValue(soinDate08h)
      mocks.queryRaw.mockResolvedValue(injections08h)
      const res = await mettreAJourProtocoleSoin('u', 233, { date: '2026-09-24', notes: 'rappel' })
      expect(res.ok).toBe(true)
      expect(insertions().map(calendrierChange)).toEqual([false, false])
    })
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
    // Lecture de garde, relecture sous le verrou (CR-SOI-01), puis état après écriture.
    mocks.queryRaw.mockResolvedValueOnce(avant).mockResolvedValueOnce(avant).mockResolvedValueOnce(apres)
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

  // C9 (revue réglementaire du 2026-11-12) : « Rouvrir » une injection
  // réalisée rendait les doses et raccourcissait ou levait le délai d'attente,
  // en un clic, sans trace. Elle n'est plus rouverte que pour une erreur de
  // saisie motivée, journalisée.
  describe('rouvrir ou annuler une injection réalisée (C9)', () => {
    const soinPreleve = { ...soinUbrolexin, nbInjections: 1, intervalleInjectionsHeures: null, stockMedicamentId: 'stock-1', quantite: 3, quantitePreleveeStock: 3 }
    const realisee = [{ id: 'i1', numero: 1, statut: 'realisee', datePrevue: soinUbrolexin.date, dateRealisee: soinUbrolexin.date }]

    it.each(['a_faire', 'annulee'] as const)('vers « %s » sans motif : refus, rien n’est rendu ni recalculé', async (statut) => {
      mocks.soinFindFirst.mockResolvedValue(soinPreleve)
      mocks.queryRaw.mockResolvedValueOnce(realisee)
      const res = await daterInjection('u', 233, { injectionId: 'i1', statut }, { gererStock: true })
      expect(res).toMatchObject({ ok: false, status: 409, code: 'ANNULATION_MOTIVEE_REQUISE' })
      expect(mocks.executeRaw).not.toHaveBeenCalled()
      expect(mocks.stockUpdate).not.toHaveBeenCalled()
      expect(mocks.resync).not.toHaveBeenCalled()
    })

    it('administration réelle déclarée : refus', async () => {
      mocks.soinFindFirst.mockResolvedValue(soinPreleve)
      mocks.queryRaw.mockResolvedValueOnce(realisee)
      const res = await daterInjection('u', 233, { injectionId: 'i1', statut: 'a_faire' }, {
        gererStock: true, annulation: { nature: 'administre', motif: 'Mauvais bouton' },
      })
      expect(res).toMatchObject({ ok: false, status: 409, code: 'SOIN_ADMINISTRE_CONSERVE' })
      expect(mocks.executeRaw).not.toHaveBeenCalled()
    })

    it('erreur de saisie motivée : journal de l’injection rouverte, puis doses rendues', async () => {
      mocks.soinFindFirst.mockResolvedValue(soinPreleve)
      const rouverte = [{ ...realisee[0], statut: 'a_faire', dateRealisee: null }]
      mocks.queryRaw.mockResolvedValueOnce(realisee).mockResolvedValueOnce(realisee).mockResolvedValueOnce(rouverte)
      const res = await daterInjection('u', 233, { injectionId: 'i1', statut: 'a_faire' }, {
        gererStock: true, annulation: { nature: 'erreur_saisie', motif: 'Injection prévue cochée trop tôt' }, acteurId: 'invite-2',
      })
      expect(res.ok).toBe(true)
      expect(mocks.annulationCreate.mock.calls[0][0].data).toMatchObject({
        userId: 'u', soinId: 233, action: 'injection_rouverte', injectionNumero: 1,
        nature: 'erreur_saisie', motif: 'Injection prévue cochée trop tôt', acteurId: 'invite-2',
      })
      expect(mocks.stockUpdate).toHaveBeenCalledWith({ where: { id: 'stock-1' }, data: { quantite: { increment: 3 } } })
    })

    it('annuler une injection encore à faire ne demande rien', async () => {
      mocks.soinFindFirst.mockResolvedValue(soinUbrolexin)
      const aFaire = [{ id: 'i2', numero: 2, statut: 'a_faire', datePrevue: J('2026-09-28T12:00:00Z'), dateRealisee: null }]
      mocks.queryRaw.mockResolvedValueOnce(aFaire).mockResolvedValueOnce(aFaire).mockResolvedValueOnce([{ ...aFaire[0], statut: 'annulee' }])
      const res = await daterInjection('u', 233, { injectionId: 'i2', statut: 'annulee' })
      expect(res.ok).toBe(true)
      expect(mocks.annulationCreate).not.toHaveBeenCalled()
    })
  })
})
