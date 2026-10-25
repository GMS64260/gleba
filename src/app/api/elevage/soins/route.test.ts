import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(), animalFindFirst: vi.fn(), produitFindUnique: vi.fn(),
  soinCreate: vi.fn(), soinFindFirst: vi.fn(), soinUpdate: vi.fn(),
  collecteUpdateMany: vi.fn(), collecteFindMany: vi.fn(), soinFindMany: vi.fn(),
  soinCount: vi.fn(), animalFindMany: vi.fn(), queryRaw: vi.fn(), executeRaw: vi.fn(),
  stockFindFirst: vi.fn(), stockUpdateMany: vi.fn(), stockUpdate: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromSoinAnimal: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    // Review caprin 2026-07-22 — l'écartement passe par la lib attente-lait, qui
    // interroge aussi `animal` (appartenance lot ↔ membres) dans la transaction.
    animal: { findFirst: mocks.animalFindFirst, findMany: mocks.animalFindMany },
    soinAnimal: { create: mocks.soinCreate, update: mocks.soinUpdate, findMany: mocks.soinFindMany },
    collecteLait: { updateMany: mocks.collecteUpdateMany, findMany: mocks.collecteFindMany },
    stockMedicamentElevage: { updateMany: mocks.stockUpdateMany, update: mocks.stockUpdate },
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
  }
  return { default: {
    animal: { findFirst: mocks.animalFindFirst },
    lotAnimaux: { findFirst: vi.fn() },
    produitVeterinaire: { findUnique: mocks.produitFindUnique },
    soinAnimal: { findFirst: mocks.soinFindFirst, findMany: mocks.soinFindMany, count: mocks.soinCount },
    stockMedicamentElevage: { findFirst: mocks.stockFindFirst },
    $queryRaw: mocks.queryRaw,
    $transaction: vi.fn(async (callback: (arg: typeof tx) => unknown) => callback(tx)),
  } }
})

import { GET, PATCH, POST } from './route'
import { dateSoinARenvoyer, jourSoin } from '@/lib/elevage/date-soin'

const request = (method: string, body: object) => new NextRequest('http://localhost/api/elevage/soins', {
  method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
})

describe('soins planifies et temps attente lait', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.animalFindFirst.mockResolvedValue({ id: 7 })
    mocks.produitFindUnique.mockResolvedValue({ id: 'p1', nom: 'Traitement', tempsAttenteLaitJ: 5, tempsAttenteViandeJ: 12 })
    mocks.collecteFindMany.mockResolvedValue([])
    mocks.soinFindMany.mockResolvedValue([])
    mocks.soinCount.mockResolvedValue(0)
    mocks.animalFindMany.mockResolvedValue([])
    mocks.collecteUpdateMany.mockResolvedValue({ count: 0 })
    mocks.queryRaw.mockResolvedValue([])
    mocks.executeRaw.mockResolvedValue(1)
    mocks.stockFindFirst.mockResolvedValue({
      id: 'stock-1',
      userId: 'user-1',
      produitId: 'p1',
      numeroLot: 'LOT-2026',
      quantite: 100,
      unite: 'mL',
      datePeremption: new Date('2027-01-01'),
      ordonnanceUrl: null,
    })
    mocks.stockUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('ne demarre pas les temps attente pour un soin seulement planifie', async () => {
    mocks.soinCreate.mockImplementation(async ({ data }) => ({ id: 1, ...data }))
    const response = await POST(request('POST', {
      animalId: 7,
      date: '2026-07-21',
      type: 'Traitement vétérinaire',
      produitId: 'p1',
      stockMedicamentId: 'stock-1',
      quantite: 2,
      unite: 'mL',
      fait: false,
    }))
    expect(response.status).toBe(201)
    expect(mocks.soinCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      tempsAttenteLaitJ: 5, finAttenteLait: null, finAttenteViande: null,
    }) }))
    expect(mocks.collecteUpdateMany).not.toHaveBeenCalled()
  })

  it('active les temps attente lors du passage du soin a realise', async () => {
    const existing = { id: 1, userId: 'user-1', animalId: 7, lotId: null, date: new Date('2026-07-21T00:00:00Z'), fait: false, tempsAttenteLaitJ: 5, tempsAttenteViandeJ: 12, finAttenteLait: null, finAttenteViande: null, cout: null, type: 'Traitement vétérinaire' }
    mocks.soinFindFirst.mockResolvedValue(existing)
    mocks.soinUpdate.mockImplementation(async ({ data }) => ({ ...existing, ...data }))
    const response = await PATCH(request('PATCH', { id: 1, fait: true }))
    expect(response.status).toBe(200)
    expect(mocks.soinUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      fait: true, finAttenteLait: new Date('2026-07-26T00:00:00Z'), finAttenteViande: new Date('2026-08-02T00:00:00Z'),
    }) }))
  })

  it('type les conditions CASE de resynchronisation des injections', async () => {
    const existing = {
      id: 1,
      userId: 'user-1',
      animalId: 7,
      lotId: null,
      date: new Date('2026-07-21T00:00:00Z'),
      fait: false,
      tempsAttenteLaitJ: 5,
      tempsAttenteOeufsJ: null,
      tempsAttenteViandeJ: 12,
      finAttenteLait: null,
      finAttenteOeufs: null,
      finAttenteViande: null,
      cout: null,
      type: 'Traitement vétérinaire',
      nbInjections: 2,
      intervalleInjectionsHeures: 24,
      stockMedicamentId: null,
      quantitePreleveeStock: 0,
    }
    mocks.soinFindFirst.mockResolvedValue(existing)
    mocks.queryRaw
      .mockResolvedValueOnce([{ id: 'inj-1', numero: 1, datePrevue: existing.date, dateRealisee: null, statut: 'a_faire' }])
      .mockResolvedValueOnce([
        { numero: 1, datePrevue: existing.date, dateRealisee: existing.date, statut: 'realisee' },
        { numero: 2, datePrevue: new Date('2026-07-22T00:00:00Z'), dateRealisee: null, statut: 'a_faire' },
      ])
    mocks.soinUpdate.mockImplementation(async ({ data }) => ({ ...existing, ...data }))

    const response = await PATCH(request('PATCH', { id: 1, fait: true }))

    expect(response.status).toBe(200)
    const insertion = mocks.executeRaw.mock.calls.find(([strings]) =>
      Array.isArray(strings) && strings.join('').includes('INSERT INTO injections_soins')
    )
    expect(insertion).toBeDefined()
    expect((insertion![0] as TemplateStringsArray).join('')).toContain('::boolean')
  })

  // api_errors du 2026-09-19 19:27 (deux essais) : rouvrir un traitement dont la
  // première injection était réalisée rendait 500 « argument of CASE/WHEN must
  // be type boolean, not type jsonb ». Cause : `a && b && realisee` interpolait
  // la LIGNE de la Map (un objet) à la place d'un booléen, et le cast
  // `::boolean` ajouté le soir même ne sauve pas un objet jsonb (« cannot cast
  // jsonb object to type boolean », prouvé contre la base). Le SQL brut ne doit
  // recevoir que des valeurs scalaires.
  it('rouvre un traitement effectué en n’interpolant que des scalaires dans le SQL brut', async () => {
    const existing = {
      id: 1,
      userId: 'user-1',
      animalId: 7,
      lotId: null,
      date: new Date('2026-07-21T00:00:00Z'),
      fait: true,
      tempsAttenteLaitJ: 5,
      tempsAttenteOeufsJ: null,
      tempsAttenteViandeJ: 12,
      finAttenteLait: new Date('2026-07-27T00:00:00Z'),
      finAttenteOeufs: null,
      finAttenteViande: new Date('2026-08-03T00:00:00Z'),
      cout: null,
      type: 'Traitement vétérinaire',
      nbInjections: 2,
      intervalleInjectionsHeures: 24,
      stockMedicamentId: null,
      quantitePreleveeStock: 0,
    }
    mocks.soinFindFirst.mockResolvedValue(existing)
    mocks.queryRaw
      .mockResolvedValueOnce([
        { id: 'inj-1', numero: 1, datePrevue: existing.date, dateRealisee: existing.date, statut: 'realisee' },
        { id: 'inj-2', numero: 2, datePrevue: new Date('2026-07-22T00:00:00Z'), dateRealisee: null, statut: 'a_faire' },
      ])
      .mockResolvedValueOnce([
        { numero: 1, datePrevue: existing.date, dateRealisee: null, statut: 'a_faire' },
        { numero: 2, datePrevue: new Date('2026-07-22T00:00:00Z'), dateRealisee: null, statut: 'a_faire' },
      ])
    mocks.soinUpdate.mockImplementation(async ({ data }) => ({ ...existing, ...data }))

    const response = await PATCH(request('PATCH', { id: 1, fait: false }))

    expect(response.status).toBe(200)
    const insertions = mocks.executeRaw.mock.calls.filter(([strings]) =>
      Array.isArray(strings) && strings.join('').includes('INSERT INTO injections_soins')
    )
    expect(insertions).toHaveLength(2)
    for (const [, ...valeurs] of insertions) {
      for (const valeur of valeurs) {
        expect(valeur === null || valeur instanceof Date || ['string', 'number', 'boolean'].includes(typeof valeur)).toBe(true)
      }
    }
    // Première injection : statut interpolé « a_faire », drapeau de réouverture vrai.
    const [, ...premiere] = insertions[0]
    expect(premiere).toContain('a_faire')
    expect(premiere.filter((v) => v === true)).toHaveLength(2)
    expect(premiere.filter((v) => typeof v === 'object' && v !== null && !(v instanceof Date))).toHaveLength(0)
  })

  // Ticket cmsof7ccx — « Rappel planifié » d'un soin déjà effectué : le GET
  // ?rappels=1 exige fait=false, un soin fait=true avec datePrevue future ne
  // remontait donc jamais. Le POST doit matérialiser un second soin planifié.
  it('crée un soin de rappel planifié quand un soin fait porte une datePrevue future', async () => {
    mocks.soinCreate.mockImplementation(async ({ data }) => ({ id: data.fait ? 1 : 2, ...data }))

    const response = await POST(request('POST', {
      animalId: 7,
      date: '2026-08-11',
      type: 'Vermifuge',
      produit: 'Dectomax',
      datePrevue: '2026-11-11',
      fait: true,
    }))

    expect(response.status).toBe(201)
    expect(mocks.soinCreate).toHaveBeenCalledTimes(2)
    const rappel = mocks.soinCreate.mock.calls[1][0].data
    expect(rappel).toMatchObject({
      animalId: 7,
      fait: false,
      type: 'Vermifuge',
      produit: 'Dectomax',
      date: new Date('2026-11-11T00:00:00Z'),
      datePrevue: new Date('2026-11-11T00:00:00Z'),
    })
    // fait=false : la fenêtre d'attente ne démarre qu'à la validation.
    expect(rappel.finAttenteLait).toBeUndefined()
    expect(rappel.notes).toBe('Rappel du soin du 11/08/2026')
    const body = await response.json()
    expect(body.rappel).toEqual({ id: 2 })
    expect(body.info).toContain('Rappel planifié le 11/11/2026')
  })

  it('ne crée pas de rappel pour une datePrevue passée (simple trace du retard)', async () => {
    mocks.soinCreate.mockImplementation(async ({ data }) => ({ id: 1, ...data }))

    const response = await POST(request('POST', {
      animalId: 7,
      date: '2026-08-11',
      type: 'Vermifuge',
      datePrevue: '2026-08-01',
      fait: true,
    }))

    expect(response.status).toBe(201)
    expect(mocks.soinCreate).toHaveBeenCalledTimes(1)
  })

  it('ne crée pas de rappel pour un soin seulement planifié (il EST le rappel)', async () => {
    mocks.soinCreate.mockImplementation(async ({ data }) => ({ id: 1, ...data }))

    const response = await POST(request('POST', {
      animalId: 7,
      date: '2026-08-11',
      type: 'Vermifuge',
      datePrevue: '2026-11-11',
      fait: false,
    }))

    expect(response.status).toBe(201)
    expect(mocks.soinCreate).toHaveBeenCalledTimes(1)
  })

  it('charge les rappels sans filtre annuel ni plafond et les scope par filière', async () => {
    mocks.soinFindMany.mockResolvedValue([])

    const response = await GET(new NextRequest(
      'http://localhost/api/elevage/soins?rappels=1&filiere=compagnie'
    ))

    expect(response.status).toBe(200)
    expect(mocks.soinFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'user-1',
        fait: false,
        datePrevue: { not: null },
        OR: [
          { animal: { especeAnimale: { filiere: 'compagnie' } } },
          { lot: { especeAnimale: { filiere: 'compagnie' } } },
        ],
      }),
    }))
    const query = mocks.soinFindMany.mock.calls[0][0]
    expect(query.where).not.toHaveProperty('date')
    expect(query).not.toHaveProperty('take')
  })

  // Ticket cmv294whk — un animal mort restait à vacciner : les rappels et le
  // compteur « à venir » ne gardent que les soins de lot ou d'un animal actif,
  // le carnet (mode historique) garde tout.
  it("écarte des rappels et du compteur les soins d'un animal sorti", async () => {
    mocks.soinFindMany.mockResolvedValue([])
    const present = { OR: [{ animalId: null }, { animal: { statut: 'actif' } }] }

    await GET(new NextRequest('http://localhost/api/elevage/soins?rappels=1&filiere=rente'))

    const query = mocks.soinFindMany.mock.calls[0][0]
    expect(query.where.AND).toEqual([present])
    expect(query.where.OR).toHaveLength(2)
    expect(mocks.soinCount).toHaveBeenCalledWith({
      where: { userId: 'user-1', fait: false, AND: [present] },
    })
  })

  it("le carnet historique garde les soins d'un animal sorti", async () => {
    mocks.soinFindMany.mockResolvedValue([])

    await GET(new NextRequest('http://localhost/api/elevage/soins?annee=all&animalId=625'))

    expect(mocks.soinFindMany.mock.calls[0][0].where).not.toHaveProperty('AND')
  })
})

// Ticket cmvnp6s3z (QA 2026-10-25) — protocole à 2 injections sur une chèvre :
// première injection faite puis « Dater » au 24/09/2026 08:00 (Paris, soit
// 06:00 UTC). « Modifier le soin », intervalle seul 48 h → 24 h, Enregistrer :
// la date réelle relue devenait 2026-09-24T02:00 (minuit UTC). Le champ Date du
// dialogue renvoyait le jour seul (« 2026-09-24 », lu minuit UTC) : la route y
// voyait une nouvelle date du soin, et les injections faites suivaient ce
// calendrier parti de minuit. Règle maintenue (vigie2cc83585) : quand le
// calendrier change (date, nombre ou intervalle), les injections faites le
// suivent ; un jour seul égal au jour du soin ne change pas sa date.
describe('ticket cmvnp6s3z : modifier le protocole garde l’heure réelle de la 1re injection', () => {
  const HUIT_HEURES_PARIS = new Date('2026-09-24T06:00:00Z')
  type Ligne = { id: string; numero: number; datePrevue: Date; dateRealisee: Date | null; statut: string }
  let injections: Ligne[]
  let soin: Record<string, unknown>

  // Fuseau du conteneur de production (docker-compose : TZ Europe/Paris).
  const tzAvant = process.env.TZ
  beforeAll(() => { process.env.TZ = 'Europe/Paris' })
  afterAll(() => {
    if (tzAvant === undefined) delete process.env.TZ
    else process.env.TZ = tzAvant
  })

  // Faux `injections_soins` : rejoue le DELETE et l'upsert de
  // `synchroniserInjections` avec la sémantique du SQL (le DO UPDATE lit la
  // ligne existante). Les drapeaux sont repérés par le SQL qui les suit : si
  // ce SQL change, le faux échoue au lieu de mentir.
  const drapeau = (strings: readonly string[], valeurs: unknown[], suite: string): boolean => {
    const i = valeurs.findIndex((_, k) => strings[k + 1].startsWith(suite))
    if (i < 0) throw new Error(`Drapeau introuvable avant « ${suite} »`)
    return valeurs[i] === true
  }
  const executerSql = async (strings: readonly string[], ...valeurs: unknown[]) => {
    const sql = strings.join('?')
    if (sql.includes('DELETE FROM injections_soins')) {
      const nombre = valeurs[2] as number
      injections = injections.filter((l) => l.numero <= nombre || l.statut === 'realisee')
      return 0
    }
    if (!sql.includes('INSERT INTO injections_soins')) return 0
    const [, , , numero, datePrevue, dateRealisee, statut] = valeurs as [string, string, number, number, Date, Date | null, string]
    const marquer = drapeau(strings, valeurs, "::boolean THEN 'realisee'")
    const rouvrir = drapeau(strings, valeurs, "::boolean THEN 'a_faire'")
    const calendrierChange = drapeau(strings, valeurs, "::boolean AND injections_soins.statut = 'realisee' THEN EXCLUDED.date_prevue")
    const ligne = injections.find((l) => l.numero === numero)
    if (!ligne) {
      injections.push({ id: `inj-${numero}`, numero, datePrevue, dateRealisee, statut })
      return 1
    }
    const etaitRealisee = ligne.statut === 'realisee'
    ligne.datePrevue = datePrevue
    ligne.statut = marquer ? 'realisee' : rouvrir ? 'a_faire' : ligne.statut
    ligne.dateRealisee = marquer ? dateRealisee : rouvrir ? null : calendrierChange && etaitRealisee ? datePrevue : ligne.dateRealisee
    return 1
  }
  const lignes = () => injections.map((l) => [l.numero, l.statut, l.datePrevue.toISOString(), l.dateRealisee?.toISOString() ?? null])

  // Corps de « Modifier le soin » (AlimentationTab, handleSubmit) pour le soin
  // courant. `date` est la valeur envoyée : jour seul « AAAA-MM-JJ » (ancien
  // écran, assistant, ou jour modifié) ou date stockée intacte (`dateEcran`).
  const corpsEcran = (date: string, protocole: { nbInjections: number; intervalleInjectionsHeures: number }) => {
    const datePrevue = soin.datePrevue as Date | null
    return {
      date, type: soin.type, description: null, produit: soin.produit, produitId: null, stockMedicamentId: null,
      dose: null, voie: null, motif: null, ordonnanceUrl: null, veterinaire: null,
      datePrevue: datePrevue ? dateSoinARenvoyer(jourSoin(datePrevue), datePrevue.toISOString()) : null,
      quantite: null, unite: null, cout: null, fait: true, notes: null, ...protocole,
      tempsAttenteLaitJ: soin.tempsAttenteLaitJ, tempsAttenteOeufsJ: null, tempsAttenteViandeJ: soin.tempsAttenteViandeJ,
      animalId: 7, id: soin.id,
    }
  }
  /** Ce que l'écran envoie pour un jour saisi : la date stockée intacte si le jour n'a pas bougé. */
  const dateEcran = (jourSaisi: string) => dateSoinARenvoyer(jourSaisi, (soin.date as Date).toISOString())

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.animalFindFirst.mockResolvedValue({ id: 7, lotId: null })
    mocks.animalFindMany.mockResolvedValue([])
    mocks.collecteFindMany.mockResolvedValue([])
    mocks.collecteUpdateMany.mockResolvedValue({ count: 0 })
    mocks.soinFindMany.mockResolvedValue([])
    // État après « Dater » : `daterInjection` a posé 08:00 sur la 1re
    // injection et déplacé la date du soin dessus (date prévue d'origine
    // gardée dans `datePrevue`).
    soin = {
      id: 42, userId: 'user-1', animalId: 7, lotId: null, type: 'Traitement vétérinaire', produit: 'Oxytétracycline',
      date: HUIT_HEURES_PARIS, datePrevue: new Date('2026-09-24T00:00:00Z'), fait: true,
      nbInjections: 2, intervalleInjectionsHeures: 48, tempsAttenteLaitJ: 7, tempsAttenteOeufsJ: null, tempsAttenteViandeJ: 28,
      finAttenteLait: new Date('2026-10-03T06:00:00Z'), finAttenteOeufs: null, finAttenteViande: new Date('2026-10-24T06:00:00Z'),
      cout: null, quantite: null, stockMedicamentId: null, quantitePreleveeStock: 0,
    }
    injections = [
      { id: 'inj-1', numero: 1, datePrevue: HUIT_HEURES_PARIS, dateRealisee: HUIT_HEURES_PARIS, statut: 'realisee' },
      { id: 'inj-2', numero: 2, datePrevue: new Date('2026-09-26T06:00:00Z'), dateRealisee: null, statut: 'a_faire' },
    ]
    mocks.soinFindFirst.mockImplementation(async () => ({ ...soin }))
    mocks.soinUpdate.mockImplementation(async ({ data }) => {
      soin = { ...soin, ...data }
      return { ...soin }
    })
    mocks.queryRaw.mockImplementation(async (strings: readonly string[]) =>
      strings.join('?').includes('FROM injections_soins')
        ? injections.map((l) => ({ ...l })).sort((a, b) => a.numero - b.numero)
        : [])
    mocks.executeRaw.mockImplementation(executerSql)
  })

  it('48 h → 24 h puis 24 h → 48 h, jour seul renvoyé : la 1re injection garde 08:00, la 2e est recalculée', async () => {
    // Corps du ticket : le jour seul, comme l'envoyait l'ancien dialogue.
    const vers24 = await PATCH(request('PATCH', corpsEcran('2026-09-24', { nbInjections: 2, intervalleInjectionsHeures: 24 })))
    expect(vers24.status).toBe(200)
    expect(lignes()).toEqual([
      [1, 'realisee', '2026-09-24T06:00:00.000Z', '2026-09-24T06:00:00.000Z'],
      [2, 'a_faire', '2026-09-25T06:00:00.000Z', null],
    ])
    expect(soin.date).toEqual(HUIT_HEURES_PARIS)
    // Attente lait ancrée sur la dernière injection du nouveau calendrier.
    expect(soin.finAttenteLait).toEqual(new Date('2026-10-02T06:00:00Z'))

    const vers48 = await PATCH(request('PATCH', corpsEcran('2026-09-24', { nbInjections: 2, intervalleInjectionsHeures: 48 })))
    expect(vers48.status).toBe(200)
    expect(lignes()).toEqual([
      [1, 'realisee', '2026-09-24T06:00:00.000Z', '2026-09-24T06:00:00.000Z'],
      [2, 'a_faire', '2026-09-26T06:00:00.000Z', null],
    ])
    expect(soin.date).toEqual(HUIT_HEURES_PARIS)
  })

  it('nombre et intervalle changés : les injections faites suivent le nouveau calendrier, la 1re garde 08:00', async () => {
    // 2e injection faite l'après-midi du jour prévu (protocole 2 × 48 h).
    injections[1] = { ...injections[1], statut: 'realisee', dateRealisee: new Date('2026-09-26T14:30:00Z') }

    const res = await PATCH(request('PATCH', corpsEcran(dateEcran('2026-09-24'), { nbInjections: 3, intervalleInjectionsHeures: 24 })))

    expect(res.status).toBe(200)
    expect(lignes()).toEqual([
      [1, 'realisee', '2026-09-24T06:00:00.000Z', '2026-09-24T06:00:00.000Z'],
      [2, 'realisee', '2026-09-25T06:00:00.000Z', '2026-09-25T06:00:00.000Z'],
      [3, 'a_faire', '2026-09-26T06:00:00.000Z', null],
    ])
  })

  it('la date du soin changée de jour : la série suit le nouveau jour, à l’heure réelle saisie', async () => {
    const res = await PATCH(request('PATCH', corpsEcran(dateEcran('2026-09-25'), { nbInjections: 2, intervalleInjectionsHeures: 48 })))

    expect(res.status).toBe(200)
    expect(soin.date).toEqual(new Date('2026-09-25T06:00:00Z'))
    expect(lignes()).toEqual([
      [1, 'realisee', '2026-09-25T06:00:00.000Z', '2026-09-25T06:00:00.000Z'],
      [2, 'a_faire', '2026-09-27T06:00:00.000Z', null],
    ])
  })

  // Cas d'origine de la règle (vigie2cc83585) : Ubrolexin ressaisi, 4
  // injections faites (la 1re à la création, les suivantes au clic du 01/10),
  // corrigé depuis l'écran en DEUX enregistrements.
  it('Ubrolexin corrigé en deux enregistrements (date, puis intervalle) : les 4 injections faites finissent à 24 h', async () => {
    const creation = new Date('2026-09-28T00:00:00Z')
    soin = {
      ...soin, id: 233, produit: 'Ubrolexin', date: creation, datePrevue: null, nbInjections: 4,
      intervalleInjectionsHeures: 12, tempsAttenteLaitJ: 5, tempsAttenteViandeJ: 10,
      finAttenteLait: new Date('2026-10-06T20:14:02Z'), finAttenteViande: new Date('2026-10-11T20:14:02Z'),
    }
    injections = [
      { id: 'u1', numero: 1, datePrevue: creation, dateRealisee: creation, statut: 'realisee' },
      { id: 'u2', numero: 2, datePrevue: new Date('2026-09-28T12:00:00Z'), dateRealisee: new Date('2026-10-01T20:13:15Z'), statut: 'realisee' },
      { id: 'u3', numero: 3, datePrevue: new Date('2026-09-29T00:00:00Z'), dateRealisee: new Date('2026-10-01T20:13:40Z'), statut: 'realisee' },
      { id: 'u4', numero: 4, datePrevue: new Date('2026-09-29T12:00:00Z'), dateRealisee: new Date('2026-10-01T20:14:02Z'), statut: 'realisee' },
    ]

    // 1er enregistrement : jour 28/09 → 10/07, intervalle inchangé.
    const r1 = await PATCH(request('PATCH', corpsEcran(dateEcran('2026-07-10'), { nbInjections: 4, intervalleInjectionsHeures: 12 })))
    expect(r1.status).toBe(200)
    expect(injections.map((l) => l.dateRealisee?.toISOString())).toEqual([
      '2026-07-10T00:00:00.000Z', '2026-07-10T12:00:00.000Z', '2026-07-11T00:00:00.000Z', '2026-07-11T12:00:00.000Z',
    ])

    // 2e enregistrement : jour non touché (l'écran renvoie la date stockée), 12 h → 24 h.
    const r2 = await PATCH(request('PATCH', corpsEcran(dateEcran('2026-07-10'), { nbInjections: 4, intervalleInjectionsHeures: 24 })))
    expect(r2.status).toBe(200)
    expect(lignes()).toEqual([
      [1, 'realisee', '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z'],
      [2, 'realisee', '2026-07-11T00:00:00.000Z', '2026-07-11T00:00:00.000Z'],
      [3, 'realisee', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'],
      [4, 'realisee', '2026-07-13T00:00:00.000Z', '2026-07-13T00:00:00.000Z'],
    ])
    // Lait remis en vente sur la dernière injection à 24 h (13/07 + 5 j), pas sur 11/07 12:00.
    expect(soin.finAttenteLait).toEqual(new Date('2026-07-18T00:00:00Z'))
  })

  it('1re injection datée 24/09 00:30 Paris (23/09 22:30 UTC) : le dialogue montre le 24/09 et ne la décale pas', async () => {
    const minuitTrente = new Date('2026-09-23T22:30:00Z')
    soin = { ...soin, date: minuitTrente }
    injections = [
      { id: 'inj-1', numero: 1, datePrevue: minuitTrente, dateRealisee: minuitTrente, statut: 'realisee' },
      { id: 'inj-2', numero: 2, datePrevue: new Date('2026-09-25T22:30:00Z'), dateRealisee: null, statut: 'a_faire' },
    ]
    expect(jourSoin(minuitTrente)).toBe('2026-09-24')

    // Jour seul renvoyé (cas le plus dur pour la route), intervalle 48 h → 24 h.
    const res = await PATCH(request('PATCH', corpsEcran('2026-09-24', { nbInjections: 2, intervalleInjectionsHeures: 24 })))

    expect(res.status).toBe(200)
    expect(soin.date).toEqual(minuitTrente)
    expect(lignes()).toEqual([
      [1, 'realisee', '2026-09-23T22:30:00.000Z', '2026-09-23T22:30:00.000Z'],
      [2, 'a_faire', '2026-09-24T22:30:00.000Z', null],
    ])
  })
})
