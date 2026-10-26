import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ cultures: vi.fn(), recolte: vi.fn(), culture: vi.fn(), transaction: vi.fn(), surcharges: vi.fn(), invalider: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: {
  culture: { findMany: mocks.cultures },
  $transaction: mocks.transaction,
} }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: mocks.invalider }))
vi.mock('./rendement-effectif', async original => ({
  ...await original<typeof import('./rendement-effectif')>(), chargerSurchargesRendement: mocks.surcharges,
}))
import { creerRecoltes, preparerRecoltes } from './creation'

const tomate = {
  id: 1, userId: 'ferme', especeId: 'tomate-id',
  espece: { nom: 'Tomate', rendement: 2, uniteRendement: 'kg_m2' },
  variete: { id: 'var-id', nom: 'Cœur de bœuf' },
  planche: { nom: 'A1', statutBio: 'AB', dateDebutConversion: null },
  dateSemis: new Date('2026-03-01'), datePlantation: new Date('2026-05-01'), dateRecolte: new Date('2026-11-01'), dateRecoltePlan: null,
  semisFait: true, plantationFaite: true, recolteFaite: false,
}
const entree = { cultureId: 1, especeId: 'tomate-id', quantite: 750, unite: 'g', date: '2026-10-26' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.cultures.mockResolvedValue([tomate])
  mocks.surcharges.mockResolvedValue(new Map())
  mocks.transaction.mockImplementation(async fn => fn({ recolte: { create: mocks.recolte }, culture: { update: mocks.culture } }))
  mocks.recolte.mockImplementation(async ({ data }) => ({ id: 42, ...data, espece: tomate.espece }))
  mocks.culture.mockResolvedValue({})
})

describe('saisie de récoltes du formulaire et de l’assistant', () => {
  it('convertit 750 g en 0,75 kg, fige le bio et conserve la date prévisionnelle', async () => {
    const resultat = await creerRecoltes('ferme', [entree], true)
    expect(resultat.ok).toBe(true)
    expect(mocks.recolte).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quantite: 0.75, unite: 'kg', userId: 'ferme', statutBioSnapshot: 'AB' }) }))
    expect(mocks.culture).toHaveBeenCalledWith({ where: { id: 1 }, data: { recolteFaite: true, dateRecolte: new Date('2026-10-26'), dateRecoltePlan: tomate.dateRecolte } })
    expect(mocks.invalider).toHaveBeenCalledWith('ferme')
  })

  it('valide tout le lot avant toute écriture, y compris la propriété de la culture', async () => {
    const resultat = await creerRecoltes('ferme', [entree, { ...entree, cultureId: 99 }], true)
    expect(resultat).toMatchObject({ ok: false, error: expect.stringContaining('introuvable') })
    expect(mocks.cultures).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'ferme', id: { in: [1, 99] } } }))
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.recolte).not.toHaveBeenCalled()
  })

  it('enregistre deux légumes dans une seule transaction', async () => {
    mocks.cultures.mockResolvedValue([tomate, { ...tomate, id: 2, especeId: 'carotte-id' }])
    const resultat = await creerRecoltes('ferme', [entree, { ...entree, cultureId: 2, especeId: 'carotte-id' }], true)
    expect(resultat.ok).toBe(true)
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.recolte).toHaveBeenCalledTimes(2)
  })

  it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY])('refuse la quantité %s sans écrire', async quantite => {
    expect((await creerRecoltes('ferme', [{ ...entree, quantite }], true)).ok).toBe(false)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('refuse les pièces au lieu d’inventer leur poids', async () => {
    expect(await preparerRecoltes('ferme', [{ ...entree, quantite: 12, unite: 'piece' }], true)).toMatchObject({ ok: false, error: expect.stringContaining('Quelle quantité') })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('respecte les bottes déclarées par la ferme, sans nombre fractionnaire', async () => {
    mocks.surcharges.mockResolvedValue(new Map([['tomate-id', { rendement: null, uniteRendement: 'bottes_m2' }]]))
    const p = await preparerRecoltes('ferme', [{ ...entree, quantite: 3, unite: 'botte' }], true)
    expect(p.ok && p.recoltes[0].data).toMatchObject({ quantite: 3, unite: 'botte' })
    expect((await preparerRecoltes('ferme', [{ ...entree, quantite: 3.5, unite: 'botte' }], true)).ok).toBe(false)
  })

  it('refuse une date antérieure à la plantation, une date invalide et une espèce différente', async () => {
    for (const changement of [{ date: '2026-04-01' }, { date: 'invalide' }, { especeId: 'autre' }]) {
      expect((await creerRecoltes('ferme', [{ ...entree, ...changement }], true)).ok).toBe(false)
    }
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('exige l’unité pour l’assistant et laisse le formulaire utiliser celle de la ferme', async () => {
    const sansUnite = { ...entree, unite: undefined }
    expect((await preparerRecoltes('ferme', [sansUnite], true)).ok).toBe(false)
    expect((await preparerRecoltes('ferme', [sansUnite])).ok).toBe(true)
  })
})
