/**
 * Revue de conformité du registre phytosanitaire du 2026-11-12 (arrêté du
 * 24 décembre 2025 relatif aux registres d'utilisation des produits
 * phytopharmaceutiques) appliquée à /api/interventions :
 *  - C3 : un traitement réalisé ne s'efface ni ne s'écrase plus sans trace ;
 *  - C4 : le référentiel et les fiches sont copiés au jour de l'enregistrement ;
 *  - C8 et MAR-03 : le PATCH écrit les valeurs VALIDÉES (« 2,5 » → 2.5, DAR 0
 *    conservé) et les champs acceptés mais jusque-là ignorés.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  historiqueCreate: vi.fn(),
  cultureFindFirst: vi.fn(),
  produitFindUnique: vi.fn(),
  membreFindFirst: vi.fn(),
  observationFindFirst: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/cache-helper', () => ({ getOrFetch: vi.fn() }))
vi.mock('@/lib/meteo', () => ({ fetchOpenMeteoHistory: vi.fn() }))
vi.mock('@/lib/irrigation-cache', () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
vi.mock('@/lib/irrigation-recording', () => ({ supprimerArrosageNote: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromIntervention: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/planches/resolution', () => ({ resoudreIdPlanche: vi.fn(async (_p: unknown, ref: string) => ref) }))
vi.mock('@/lib/prisma', () => {
  const db: Record<string, unknown> = {
    $executeRaw: vi.fn(),
    intervention: { create: mocks.create, findFirst: mocks.findFirst, update: mocks.update, delete: mocks.remove },
    registrePhytoHistorique: { create: mocks.historiqueCreate },
    culture: { findFirst: mocks.cultureFindFirst },
    planche: { findFirst: vi.fn(async () => null) },
    arbre: { findFirst: vi.fn(async () => null) },
    parcelleGeo: { findFirst: vi.fn(async () => null) },
    produitPhyto: { findUnique: mocks.produitFindUnique },
    membreExploitation: { findFirst: mocks.membreFindFirst },
    observationSante: { findFirst: mocks.observationFindFirst },
  }
  db.$transaction = async (fn: (tx: unknown) => unknown) => fn(db)
  return { default: db }
})

import { DELETE, PATCH, POST } from './route'

const requete = (method: string, body?: object, query = '') =>
  new NextRequest(`http://localhost/api/interventions${query}`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  })

const traitementRealise = {
  id: 42,
  userId: 'u1',
  type: 'traitement_phyto',
  fait: true,
  date: new Date('2026-05-04T08:00:00Z'),
  cultureId: 461,
  plancheId: null,
  arbreId: null,
  parcelleId: null,
  produitPhyto: 'Produit A',
  numAMM: '2100123',
  doseAppliquee: 1.5,
  uniteDose: 'L/ha',
  dar: 7,
  dureeMinutes: 30,
  cultureRegistre: 'Tomate',
  localisationRegistre: 'Planche P3',
  conduiteBio: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
  mocks.create.mockImplementation(async ({ data }) => ({ id: 1, ...data }))
  mocks.update.mockImplementation(async ({ data }) => ({ ...traitementRealise, ...data }))
  mocks.findFirst.mockResolvedValue(traitementRealise)
  mocks.cultureFindFirst.mockResolvedValue({
    id: 461,
    espece: { id: 'tomate', nom: 'Tomate' },
    variete: { id: 'cdb', nom: 'Cœur de bœuf' },
    planche: { nom: 'P3', ilot: 'Nord', statutBio: 'AB', dateDebutConversion: null, parcelleGeo: null },
  })
  mocks.membreFindFirst.mockResolvedValue(null)
})

describe('C3 : historique des rectifications', () => {
  it("DELETE d'un traitement réalisé : l'état complet d'avant est journalisé, avec motif et auteur", async () => {
    const res = await DELETE(requete('DELETE', undefined, '?id=42&motif=Saisie%20en%20double'))
    expect(res.status).toBe(200)
    expect(mocks.historiqueCreate).toHaveBeenCalledTimes(1)
    const { data } = mocks.historiqueCreate.mock.calls[0][0]
    expect(data).toMatchObject({
      userId: 'u1',
      source: 'intervention',
      sourceId: 42,
      action: 'suppression',
      motif: 'Saisie en double',
      auteurId: 'u1',
    })
    expect(data.avant).toMatchObject({ produitPhyto: 'Produit A', numAMM: '2100123', doseAppliquee: 1.5 })
    // Journal avant suppression, dans la même transaction.
    expect(mocks.historiqueCreate.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0])
  })

  it("DELETE d'un arrosage : rien n'est journalisé", async () => {
    mocks.findFirst.mockResolvedValue({ ...traitementRealise, type: 'arrosage' })
    expect((await DELETE(requete('DELETE', undefined, '?id=42'))).status).toBe(200)
    expect(mocks.historiqueCreate).not.toHaveBeenCalled()
  })

  it("DELETE d'un traitement seulement planifié : rien n'est journalisé (il n'est pas au registre)", async () => {
    mocks.findFirst.mockResolvedValue({ ...traitementRealise, fait: false })
    expect((await DELETE(requete('DELETE', undefined, '?id=42'))).status).toBe(200)
    expect(mocks.historiqueCreate).not.toHaveBeenCalled()
  })

  it("PATCH d'un traitement réalisé : avant et après sont journalisés", async () => {
    const res = await PATCH(requete('PATCH', { id: 42, doseAppliquee: '2', motif: 'Dose mal recopiée' }))
    expect(res.status).toBe(200)
    const { data } = mocks.historiqueCreate.mock.calls[0][0]
    expect(data).toMatchObject({ action: 'modification', motif: 'Dose mal recopiée' })
    expect(data.avant.doseAppliquee).toBe(1.5)
    expect(data.apres.doseAppliquee).toBe(2)
  })
})

describe('C8 et MAR-03 : le PATCH écrit les valeurs validées', () => {
  it('« 2,5 » et « 12,75 » : enregistrés 2.5 et 12.75, plus tronqués en 2 et 12', async () => {
    const res = await PATCH(requete('PATCH', { id: 42, doseAppliquee: '2,5', coutTotal: '12,75' }))
    expect(res.status).toBe(200)
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ doseAppliquee: 2.5, coutTotal: 12.75 })
  })

  it('un DAR de 0 reste 0 (il devenait NULL)', async () => {
    await PATCH(requete('PATCH', { id: 42, dar: 0 }))
    expect(mocks.update.mock.calls[0][0].data.dar).toBe(0)
  })

  it('un champ vide est effacé, un champ absent est laissé tel quel', async () => {
    await PATCH(requete('PATCH', { id: 42, cibleTraitement: '' }))
    const data = mocks.update.mock.calls[0][0].data
    expect(data.cibleTraitement).toBeNull()
    expect('doseAppliquee' in data).toBe(false)
  })

  it('météo structurée, certificat et mentions de l’annexe I : écrits', async () => {
    const res = await PATCH(requete('PATCH', {
      id: 42, temperatureC: '12,5', ventKmh: 8, certiphytoNum: 'CP123', stadeBBCH: '65', heureDebut: '06:30',
    }))
    expect(res.status).toBe(200)
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({
      temperatureC: 12.5, ventKmh: 8, certiphytoNum: 'CP123', stadeBBCH: '65', heureDebut: '06:30',
    })
  })

  it("un opérateur hors de l'exploitation est refusé, le titulaire est enregistré", async () => {
    const refus = await PATCH(requete('PATCH', { id: 42, operateurId: 'compte-tiers' }))
    expect(refus.status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()

    expect((await PATCH(requete('PATCH', { id: 42, operateurId: 'u1' }))).status).toBe(200)
    expect(mocks.update.mock.calls[0][0].data.operateurId).toBe('u1')
  })

  it('une heure mal formée est refusée', async () => {
    expect((await PATCH(requete('PATCH', { id: 42, heureDebut: '25:00' }))).status).toBe(400)
  })
})

describe('C4 : copie au jour de l’enregistrement', () => {
  const corps = {
    date: '2026-05-04',
    type: 'traitement_phyto',
    cultureId: 461,
    fait: true,
    dureeMinutes: 20,
    doseAppliquee: '1,2',
    uniteDose: 'L/ha',
  }

  it('produit du référentiel : nom, AMM et DAR copiés sur le traitement', async () => {
    mocks.produitFindUnique.mockResolvedValue({ nomCommercial: 'Produit B', amm: '9800203', darJours: 14 })
    const res = await POST(requete('POST', { ...corps, produitPhytoId: 'p1' }))
    expect(res.status).toBe(201)
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      produitPhyto: 'Produit B', numAMM: '9800203', dar: 14, produitPhytoId: 'p1',
    })
  })

  it('un produit inconnu du référentiel est refusé', async () => {
    mocks.produitFindUnique.mockResolvedValue(null)
    expect((await POST(requete('POST', { ...corps, produitPhytoId: 'inconnu' }))).status).toBe(400)
  })

  it('culture, localisation et conduite biologique figées à la création', async () => {
    await POST(requete('POST', corps))
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      cultureRegistre: 'Tomate (Cœur de bœuf)',
      localisationRegistre: 'Planche P3 (îlot Nord)',
      conduiteBio: true,
    })
  })

  it('opérateur et certificat acceptés au POST sont enregistrés', async () => {
    await POST(requete('POST', { ...corps, operateurId: 'u1', certiphytoNum: 'CP9' }))
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ operateurId: 'u1', certiphytoNum: 'CP9' })
  })
})
