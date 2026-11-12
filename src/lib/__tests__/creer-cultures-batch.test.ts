/**
 * Revue du 2026-10-11 (QA cmv2r2rl8, cmv2r1v63) — « Créer quand même » une étape
 * de rotation non suivie passe par `creerCulturesBatch` : la même règle
 * d'occupation que POST /api/cultures s'y applique. Corps rejoué : celui que
 * l'écran Créer les cultures envoie (planche par son nom, ITP, année).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const m = {
    itpFindMany: vi.fn(),
    plancheFindMany: vi.fn(),
    cultureFindFirst: vi.fn(),
    cultureCreate: vi.fn(),
    varieteFindMany: vi.fn(),
    placeholder: vi.fn(),
    executeRaw: vi.fn(),
    // Ordre des appels sous la transaction (verrou, lectures, écritures).
    journal: [] as string[],
  }
  const note = <T extends (...args: never[]) => unknown>(nom: string, f: T) =>
    ((...args: Parameters<T>) => {
      m.journal.push(nom)
      return f(...args)
    }) as T
  // Client de transaction : le lot ne doit lire et écrire que par lui.
  const tx = {
    $executeRaw: note('verrou', m.executeRaw),
    iTP: { findMany: note('itps', m.itpFindMany) },
    planche: { findMany: note('planches', m.plancheFindMany) },
    culture: { findFirst: m.cultureFindFirst, create: note('creation', m.cultureCreate) },
    variete: { findMany: m.varieteFindMany },
  }
  const transaction = vi.fn(async (lot: (client: typeof tx) => Promise<unknown>) => lot(tx))
  return { ...m, tx, transaction }
})

vi.mock('@/lib/prisma', () => ({
  default: { $transaction: mocks.transaction },
}))
vi.mock('@/lib/varietes', () => ({ ensurePlaceholderVariete: mocks.placeholder }))
// Mock partiel : `calendrier-climat` dérive ses zones de `terroir` au chargement.
vi.mock('@/lib/terroir', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/terroir')>()),
  zoneEffectiveUser: vi.fn().mockResolvedValue(null),
}))

import { creerCulturesBatch } from '../planification'

const ITP_OIGNON = {
  id: 'Oignon-printemps',
  especeId: 'Oignon',
  espece: { id: 'Oignon', vivace: false },
  userId: null,
  zoneClimat: null,
  semaineSemis: 10,
  semainePlantation: 14,
  semaineRecolte: 28,
  semaineRecolteFin: 32,
  dureeRecolte: 4,
  nbRangs: 4,
  espacement: 10,
  espacementRangs: 25,
}

// Planche de 0,90 m : radis (4 rangs, espacement inconnu → 0,10 m) et zinnia
// d'un rang en place sur la période de l'oignon.
const planche = (cultures: unknown[], largeur = 0.9) => ({
  id: 'cmv2epoyb000vriklr0lp3chn',
  nom: 'Marc-v7-QA2-1010',
  largeur,
  longueur: 24,
  cultures,
})
const enPlace = (id: number, nbRangs: number, espacementRangs: number | null) => ({
  id,
  espece: { id: `e${id}`, vivace: false },
  nbRangs,
  itp: { espacementRangs },
  dateSemis: new Date('2027-01-01T00:00:00Z'),
  datePlantation: null,
  dateRecolte: new Date('2027-09-01T00:00:00Z'),
  finRecolte: null,
})

describe('creerCulturesBatch — occupation de la planche', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.itpFindMany.mockResolvedValue([ITP_OIGNON])
    mocks.cultureFindFirst.mockResolvedValue(null)
    mocks.cultureCreate.mockImplementation(async ({ data }) => ({ id: 2001, ...data }))
    mocks.varieteFindMany.mockResolvedValue([])
    mocks.placeholder.mockImplementation(async (especeId: string) => `${especeId} — Non spécifiée`)
  })

  it("écarte une étape qui ne tient pas, avec le motif et l'ajustement", async () => {
    mocks.plancheFindMany.mockResolvedValue([planche([enPlace(1173, 4, null), enPlace(1174, 1, 35)])])

    const r = await creerCulturesBatch('u1', [{ plancheId: 'Marc-v7-QA2-1010', itpId: 'Oignon-printemps', annee: 2027 }])

    expect(r.created).toBe(0)
    expect(mocks.cultureCreate).not.toHaveBeenCalled()
    expect(r.ignorees[0].motif).toMatch(/Largeur insuffisante : besoin de 0\.75m, disponible 0\.50m/)
    // 3 rangs × 25 cm = 0,50 m : un ajustement exact tient (pas d'arrondi flottant).
    expect(r.ignorees[0].motif).toMatch(/en réduisant à 3 rangs$/)
  })

  it('crée quand elle tient, avec la fenêtre de récolte de l’ITP', async () => {
    mocks.plancheFindMany.mockResolvedValue([planche([enPlace(1174, 1, 35)], 1.2)])

    const r = await creerCulturesBatch('u1', [{ plancheId: 'Marc-v7-QA2-1010', itpId: 'Oignon-printemps', annee: 2027 }])

    expect(r.created).toBe(1)
    const data = mocks.cultureCreate.mock.calls[0][0].data
    expect(data.nbRangs).toBe(4)
    expect(data.finRecolte).toBeInstanceOf(Date)
    expect(data.finRecolte.getTime()).toBeGreaterThan(data.dateRecolte.getTime())
  })
})

describe('creerCulturesBatch — transaction, irrigation et avertissements (relecture du 2026-11-12)', () => {
  const ligne = { plancheId: 'Marc-v7-QA2-1010', itpId: 'Oignon-printemps', annee: 2027 }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.journal.length = 0
    mocks.itpFindMany.mockResolvedValue([ITP_OIGNON])
    mocks.plancheFindMany.mockResolvedValue([planche([], 1.2)])
    mocks.cultureFindFirst.mockResolvedValue(null)
    mocks.cultureCreate.mockImplementation(async ({ data }) => ({ id: 2001, ...data }))
    mocks.varieteFindMany.mockResolvedValue([])
    mocks.placeholder.mockImplementation(async (especeId: string) => `${especeId} — Non spécifiée`)
  })

  it('tout le lot passe par une transaction, verrou de l’exploitation pris avant toute lecture', async () => {
    const r = await creerCulturesBatch('u1', [ligne])

    expect(r.created).toBe(1)
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.journal).toEqual(['verrou', 'itps', 'planches', 'creation'])
    // Le verrou porte l'identifiant de l'exploitation.
    expect(JSON.stringify(mocks.executeRaw.mock.calls[0])).toContain('u1')
    // La variété de repli est créée dans la même transaction.
    expect(mocks.placeholder).toHaveBeenCalledWith('Oignon', mocks.tx)
  })

  it('un échec en ligne N remonte hors de la transaction : rien n’est validé', async () => {
    mocks.plancheFindMany.mockResolvedValue([
      planche([], 1.2),
      { ...planche([], 1.2), id: 'p2', nom: 'Seconde' },
    ])
    mocks.cultureCreate
      .mockImplementationOnce(async ({ data }) => ({ id: 2001, ...data }))
      .mockRejectedValueOnce(new Error('écriture refusée'))

    await expect(
      creerCulturesBatch('u1', [ligne, { ...ligne, plancheId: 'Seconde' }])
    ).rejects.toThrow('écriture refusée')
    // La fonction de transaction a rejeté : la base annule la première création.
    await expect(mocks.transaction.mock.results[0].value).rejects.toThrow('écriture refusée')
  })

  it('marque à irriguer une espèce gourmande en eau, comme la création unitaire', async () => {
    mocks.itpFindMany.mockResolvedValue([{ ...ITP_OIGNON, espece: { id: 'Oignon', vivace: false, besoinEau: 4 } }])
    await creerCulturesBatch('u1', [ligne])
    expect(mocks.cultureCreate.mock.calls[0][0].data.aIrriguer).toBe(true)

    mocks.cultureCreate.mockClear()
    mocks.itpFindMany.mockResolvedValue([ITP_OIGNON])
    mocks.plancheFindMany.mockResolvedValue([planche([], 1.2)])
    await creerCulturesBatch('u1', [ligne])
    expect(mocks.cultureCreate.mock.calls[0][0].data.aIrriguer ?? null).toBeNull()
  })

  it('crée et signale quand l’espacement entre rangs de l’itinéraire est inconnu', async () => {
    mocks.itpFindMany.mockResolvedValue([{ ...ITP_OIGNON, espacementRangs: null }])
    const r = await creerCulturesBatch('u1', [ligne])

    expect(r.created).toBe(1)
    expect(r.avertissements).toEqual([
      { plancheId: 'Marc-v7-QA2-1010', itpId: 'Oignon-printemps', message: expect.stringMatching(/Espacement entre rangs inconnu/) },
    ])
  })

  it('aucun avertissement quand l’occupation a été vérifiée', async () => {
    expect((await creerCulturesBatch('u1', [ligne])).avertissements).toEqual([])
  })
})

describe('creerCulturesBatch — dates, variété et motifs (revue du 2026-11-11)', () => {
  const ligne = { plancheId: 'Marc-v7-QA2-1010', itpId: 'Oignon-printemps' }
  const jour = (d: Date | null) => d?.toISOString() ?? null

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.itpFindMany.mockResolvedValue([ITP_OIGNON])
    mocks.plancheFindMany.mockResolvedValue([planche([], 1.2)])
    mocks.cultureFindFirst.mockResolvedValue(null)
    mocks.cultureCreate.mockImplementation(async ({ data }) => ({ id: 2001, ...data }))
    mocks.varieteFindMany.mockResolvedValue([])
    mocks.placeholder.mockImplementation(async (especeId: string) => `${especeId} — Non spécifiée`)
  })

  it('année ISO à 53 semaines : une plantation reportée à l’année suivante garde sa semaine', async () => {
    // 2026 compte 53 semaines : « + 52 semaines » posait la plantation S05 au
    // lundi 25/01/2027 (S04) au lieu du 01/02/2027.
    mocks.itpFindMany.mockResolvedValue([
      { ...ITP_OIGNON, semaineSemis: 45, semainePlantation: 5, semaineRecolte: 20, semaineRecolteFin: null, dureeRecolte: null },
    ])

    await creerCulturesBatch('u1', [{ ...ligne, annee: 2026 }])

    const data = mocks.cultureCreate.mock.calls[0][0].data
    expect(jour(data.dateSemis)).toBe('2026-11-02T00:00:00.000Z')
    expect(jour(data.datePlantation)).toBe('2027-02-01T00:00:00.000Z')
    expect(jour(data.dateRecolte)).toBe('2027-05-17T00:00:00.000Z')
  })

  it('itinéraire pluriannuel : la récolte tombe à sa semaine, N années plus tard', async () => {
    // Plantation S25, récolte S26, 1 095 jours de culture : pas une récolte
    // sept jours après la plantation.
    mocks.itpFindMany.mockResolvedValue([
      { ...ITP_OIGNON, semaineSemis: null, semainePlantation: 25, semaineRecolte: 26, semaineRecolteFin: null, dureeRecolte: null, dureeCulture: 1095 },
    ])

    await creerCulturesBatch('u1', [{ ...ligne, annee: 2027 }])

    const data = mocks.cultureCreate.mock.calls[0][0].data
    expect(data.datePlantation.getUTCFullYear()).toBe(2027)
    expect(data.dateRecolte.getUTCFullYear()).toBe(2030)
  })

  it('sans variété demandée, écrit la variété de repli de l’espèce', async () => {
    await creerCulturesBatch('u1', [{ ...ligne, annee: 2027 }, { ...ligne, plancheId: 'cmv2epoyb000vriklr0lp3chn', annee: 2028 }])

    expect(mocks.cultureCreate.mock.calls.map((c) => c[0].data.varieteId)).toEqual([
      'Oignon — Non spécifiée',
      'Oignon — Non spécifiée',
    ])
    // Une seule résolution par espèce pour tout le lot.
    expect(mocks.placeholder).toHaveBeenCalledTimes(1)
  })

  it('écarte la ligne dont la variété est invisible ou d’une autre espèce', async () => {
    // La base ne rend que les variétés visibles du compte : « Marmande » est une tomate.
    mocks.varieteFindMany.mockResolvedValue([{ id: 'Marmande', especeId: 'Tomate' }])

    const r = await creerCulturesBatch('u1', [
      { ...ligne, annee: 2027, varieteId: 'Marmande' },
      { ...ligne, annee: 2028, varieteId: 'variete-privee-d-un-autre' },
    ])

    expect(mocks.cultureCreate).not.toHaveBeenCalled()
    expect(r.created).toBe(0)
    expect(r.ignorees.map((i) => i.motif)).toEqual([
      expect.stringMatching(/variété/),
      expect.stringMatching(/variété/),
    ])
    // Lecture bornée aux variétés du catalogue, partagées ou du compte.
    const where = mocks.varieteFindMany.mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain('"userId":"u1"')
    expect(JSON.stringify(where)).toContain('"partageCommunaute":true')
  })

  it('garde la variété demandée quand elle est de l’espèce', async () => {
    mocks.varieteFindMany.mockResolvedValue([{ id: 'Stuttgart', especeId: 'Oignon' }])

    await creerCulturesBatch('u1', [{ ...ligne, annee: 2027, varieteId: 'Stuttgart' }])

    expect(mocks.cultureCreate.mock.calls[0][0].data.varieteId).toBe('Stuttgart')
    expect(mocks.placeholder).not.toHaveBeenCalled()
  })

  it('nomme l’espèce dans le motif « déjà une culture », même personnelle', async () => {
    mocks.itpFindMany.mockResolvedValue([
      { ...ITP_OIGNON, especeId: 'cmespeceperso0001', espece: { id: 'cmespeceperso0001', nom: 'Oca du Pérou', vivace: false } },
    ])
    mocks.cultureFindFirst.mockResolvedValue({ id: 77 })

    const r = await creerCulturesBatch('u1', [{ ...ligne, annee: 2027 }])

    expect(r.ignorees[0].motif).toBe('déjà une culture de Oca du Pérou sur cette planche en 2027')
  })
})
