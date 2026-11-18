/**
 * ADV88 (contre-revue 2026-11-15) — un soin médicamenteux planifié sans
 * médicament de la pharmacie passait à « fait » sans délai d'attente : l'animal
 * pouvait ensuite être abattu sans attente viande. Règle de la création (B6),
 * rejouée à CHAQUE passage à « fait » : PATCH /api/elevage/soins, PATCH
 * /api/elevage/soins/[id]/injections et l'outil `dater_injection` de
 * l'assistant. Refus 422 DELAIS_ATTENTE_REQUIS sans aucune écriture ; les
 * délais peuvent être fournis dans la validation (0 accepté).
 *
 * L'outil `dater_injection` appelle le même service `daterInjection` que la
 * route des injections ; son relais (délais transmis, refus et consigne) est
 * testé dans `src/lib/chat/executor-elevage-lots-soins.test.ts`, à côté de
 * l'exécuteur de l'assistant. Les cas `update_soin` sont dans
 * `src/lib/chat/executor-elevage-soin-delais.test.ts` (zone privée).
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  animal: { findFirst: vi.fn() },
  lotAnimaux: { findFirst: vi.fn() },
  soinAnimal: { findFirst: vi.fn(), update: vi.fn() },
  produitVeterinaire: { findUnique: vi.fn() },
  stockMedicamentElevage: { findFirst: vi.fn(), updateMany: vi.fn() },
  annulationSoinAnimal: { create: vi.fn() },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}))
const session = vi.hoisted(() => ({ user: { id: 'ferme-a', acteurId: 'ferme-a' } as { id: string; acteurId: string } }))
vi.mock('@/lib/prisma', () => ({ default: db }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: vi.fn(async () => ({ error: null, session })) }))
vi.mock('@/lib/comptabilite/verrou-reglements', () => ({ verrouillerReglements: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromSoinAnimal: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/elevage/effectif-traite', () => ({ effectifTraiteAuJour: vi.fn(async () => null) }))
vi.mock('@/lib/elevage/attente-lait', () => ({
  ciblesLaitAffectees: vi.fn(async () => ({ animalIds: [], lotIds: [] })),
  resyncEcartementLait: vi.fn(async () => 0),
}))

import { PATCH as PATCH_SOIN } from '@/app/api/elevage/soins/route'
import { PATCH as PATCH_INJECTION } from '@/app/api/elevage/soins/[id]/injections/route'
import { createDepenseFromSoinAnimal } from '@/lib/auto-compta'

const BOVIN_MALE = {
  id: 7, sexe: 'male', orientationProduction: 'viande',
  especeAnimale: { type: 'mammifere_grand', production: 'viande', productions: [] },
}
const VACHE_LAITIERE = {
  id: 7, sexe: 'femelle', orientationProduction: 'lait',
  especeAnimale: { type: 'mammifere_grand', production: 'lait', productions: [] },
}
const LOT_PONDEUSES = { id: 8, especeAnimale: { type: 'volaille', production: 'oeufs', productions: [] } }

const DATE_SOIN = new Date('2026-11-10T08:00:00Z')
function soinPlanifie(extra: Record<string, unknown> = {}) {
  return {
    id: 1, userId: 'ferme-a', animalId: 7, lotId: null, date: DATE_SOIN, datePrevue: DATE_SOIN, fait: false,
    type: 'Traitement vétérinaire', produit: null, produitId: null, stockMedicamentId: null, quantite: null,
    quantitePreleveeStock: 0, nbInjections: 1, intervalleInjectionsHeures: null, cout: null,
    tempsAttenteLaitJ: null, tempsAttenteViandeJ: null, tempsAttenteOeufsJ: null,
    finAttenteLait: null, finAttenteViande: null, finAttenteOeufs: null, delaiAttenteSource: 'saisie_libre',
    ...extra,
  }
}
const INJECTION_1: { id: string; numero: number; datePrevue: Date; dateRealisee: Date | null; statut: string } = { id: 'inj-1', numero: 1, datePrevue: DATE_SOIN, dateRealisee: null, statut: 'a_faire' }

type Surface = 'patch-soin' | 'patch-injection'

/** Valide le soin n°1 par la surface donnée ; `delais` = délais fournis à la validation. */
async function valider(surface: Surface, delais: Record<string, unknown> = {}) {
  if (surface === 'patch-soin') {
    const r = await PATCH_SOIN(new NextRequest('http://localhost/api/elevage/soins', {
      method: 'PATCH', body: JSON.stringify({ id: 1, fait: true, ...delais }), headers: { 'content-type': 'application/json' },
    }))
    return { status: r.status, corps: await r.json() }
  }
  {
    const r = await PATCH_INJECTION(new NextRequest('http://localhost/api/elevage/soins/1/injections', {
      method: 'PATCH', body: JSON.stringify({ injectionId: 'inj-1', statut: 'realisee', dateRealisee: '2026-11-10T08:00:00Z', ...delais }), headers: { 'content-type': 'application/json' },
    }), { params: Promise.resolve({ id: '1' }) })
    return { status: r.status, corps: await r.json() }
  }
}

function rienEcrit() {
  expect(db.$transaction).not.toHaveBeenCalled()
  expect(db.soinAnimal.update).not.toHaveBeenCalled()
  expect(db.$executeRaw).not.toHaveBeenCalled()
  expect(db.stockMedicamentElevage.updateMany).not.toHaveBeenCalled()
  expect(createDepenseFromSoinAnimal).not.toHaveBeenCalled()
}

/** Refus constaté sous le verrou : transaction ouverte, mais aucune écriture. */
function rienEcritSousVerrou() {
  expect(db.soinAnimal.update).not.toHaveBeenCalled()
  expect(db.$executeRaw).not.toHaveBeenCalled()
  expect(db.stockMedicamentElevage.updateMany).not.toHaveBeenCalled()
  expect(createDepenseFromSoinAnimal).not.toHaveBeenCalled()
}

/**
 * Une autre requête (onglet, membre) a corrigé le soin et fini sa transaction
 * entre notre première lecture et l'acquisition de notre mutex.
 */
function correctionConcurrente(modif: Record<string, unknown>) {
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => {
    soinEnBase = { ...soinEnBase, ...modif }
    return fn(db)
  })
}

/** Données du soin écrites (dernière écriture du soin). */
function soinEcrit() {
  return Object.assign({}, ...db.soinAnimal.update.mock.calls.map(([q]) => q.data))
}

let soinEnBase: ReturnType<typeof soinPlanifie>

describe.each<Surface>(['patch-soin', 'patch-injection'])('ADV88 — délais exigés au passage à « fait », surface %s', (surface) => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.user = { id: 'ferme-a', acteurId: 'ferme-a' }
    soinEnBase = soinPlanifie()
    db.soinAnimal.findFirst.mockImplementation(async ({ where }) => (where.userId === soinEnBase.userId && where.id === soinEnBase.id ? soinEnBase : null))
    db.soinAnimal.update.mockImplementation(async ({ data }) => {
      soinEnBase = { ...soinEnBase, ...data }
      return soinEnBase
    })
    let injections = [{ ...INJECTION_1 }]
    db.$queryRaw.mockImplementation(async () => injections)
    db.$executeRaw.mockImplementation(async (sql: TemplateStringsArray) => {
      if (sql.join('?').includes('UPDATE injections_soins') || sql.join('?').includes('INSERT INTO injections_soins')) {
        injections = [{ ...INJECTION_1, statut: 'realisee', dateRealisee: DATE_SOIN }]
      }
      return 1
    })
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db))
    db.animal.findFirst.mockImplementation(async ({ where }) => (where.userId === 'ferme-a' && where.id === 7 ? BOVIN_MALE : null))
    db.lotAnimaux.findFirst.mockImplementation(async ({ where }) => (where.userId === 'ferme-a' && where.id === 8 ? LOT_PONDEUSES : null))
  })

  it('bovin, soin planifié sans produit ni délai : 422 DELAIS_ATTENTE_REQUIS [viande], soin toujours planifié', async () => {
    const { status, corps } = await valider(surface)
    expect(status).toBe(422)
    expect(corps.code).toBe('DELAIS_ATTENTE_REQUIS')
    expect(corps.delaisManquants).toEqual(['viande'])
    expect(corps.error).toContain('Délai d’attente viande manquant')
    expect(corps.error).toContain('Le soin reste à faire')
    rienEcrit()
    expect(soinEnBase.fait).toBe(false)
    expect(db.animal.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7, userId: 'ferme-a' } }))
  })

  it('le délai viande fourni à la validation (0 compris) est accepté et enregistré', async () => {
    const { status } = await valider(surface, { tempsAttenteViandeJ: 0 })
    expect(status).toBe(200)
    expect(soinEnBase.fait).toBe(true)
    expect(soinEcrit()).toMatchObject({ fait: true, tempsAttenteViandeJ: 0 })
  })

  it('3 jours viande fournis : la fin d’attente viande est posée', async () => {
    const { status } = await valider(surface, { tempsAttenteViandeJ: 3 })
    expect(status).toBe(200)
    expect(soinEnBase.finAttenteViande).toEqual(new Date('2026-11-13T08:00:00Z'))
    expect(soinEnBase.delaiAttenteSource).toBe('prescription')
  })

  it('un délai viande déjà stocké sur le soin suffit', async () => {
    soinEnBase = soinPlanifie({ tempsAttenteViandeJ: 5 })
    const { status } = await valider(surface)
    expect(status).toBe(200)
    expect(soinEnBase.fait).toBe(true)
  })

  it('vache laitière : le délai lait est exigé en plus, comme à la création', async () => {
    db.animal.findFirst.mockResolvedValue(VACHE_LAITIERE)
    const { status, corps } = await valider(surface, { tempsAttenteViandeJ: 3 })
    expect(status).toBe(422)
    expect(corps.delaisManquants).toEqual(['lait'])
    rienEcrit()
    expect((await valider(surface, { tempsAttenteViandeJ: 3, tempsAttenteLaitJ: 0 })).status).toBe(200)
  })

  it('lot de pondeuses : le délai œufs est exigé en plus, comme à la création', async () => {
    soinEnBase = soinPlanifie({ animalId: null, lotId: 8, tempsAttenteViandeJ: 5 })
    const { status, corps } = await valider(surface)
    expect(status).toBe(422)
    expect(corps.delaisManquants).toEqual(['oeufs'])
    expect(corps.error).toContain('Délai d’attente œufs manquant')
    rienEcrit()
    expect(db.lotAnimaux.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 8, userId: 'ferme-a' } }))
  })

  it('un soin d’une autre exploitation : 404, rien d’écrit', async () => {
    soinEnBase = soinPlanifie({ userId: 'ferme-b' })
    const { status } = await valider(surface, { tempsAttenteViandeJ: 3 })
    expect(status).toBe(404)
    rienEcrit()
  })

  it('membre ≠ propriétaire : la règle s’applique sur l’exploitation du propriétaire', async () => {
    session.user = { id: 'ferme-a', acteurId: 'membre-1' }
    const { status, corps } = await valider(surface)
    expect(status).toBe(422)
    expect(corps.delaisManquants).toEqual(['viande'])
    expect(db.soinAnimal.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 1, userId: 'ferme-a' }) }))
    expect(db.animal.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7, userId: 'ferme-a' } }))
    expect(db.animal.findFirst).not.toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'membre-1' }) }))
    rienEcrit()
  })

  it('un soin avec médicament de la pharmacie n’est pas concerné (délais AMM du produit)', async () => {
    soinEnBase = soinPlanifie({ produitId: 'produit-fictif' })
    const { status } = await valider(surface)
    expect(status).toBe(200)
  })

  it('un soin non médicamenteux (Tonte) passe à « fait » sans délai', async () => {
    soinEnBase = soinPlanifie({ type: 'Tonte' })
    const { status } = await valider(surface)
    expect(status).toBe(200)
  })

  // Revues QA115 / ADV116 : la règle se rejoue sous le verrou sur le soin relu.
  it('concurrence : type corrigé en Traitement vétérinaire avant le verrou → 422, rien d’écrit', async () => {
    soinEnBase = soinPlanifie({ type: 'Tonte' })
    correctionConcurrente({ type: 'Traitement vétérinaire' })
    const { status, corps } = await valider(surface)
    expect(status).toBe(422)
    expect(corps.code).toBe('DELAIS_ATTENTE_REQUIS')
    expect(corps.delaisManquants).toEqual(['viande'])
    rienEcritSousVerrou()
    expect(soinEnBase).toMatchObject({ fait: false, type: 'Traitement vétérinaire', tempsAttenteViandeJ: null })
  })

  it('concurrence : délai viande stocké retiré avant le verrou → 422, rien d’écrit', async () => {
    soinEnBase = soinPlanifie({ tempsAttenteViandeJ: 3 })
    correctionConcurrente({ tempsAttenteViandeJ: null })
    const { status, corps } = await valider(surface)
    expect(status).toBe(422)
    expect(corps.delaisManquants).toEqual(['viande'])
    rienEcritSousVerrou()
    expect(soinEnBase.fait).toBe(false)
  })

  it('concurrence : médicament de la pharmacie retiré avant le verrou → 422, rien d’écrit', async () => {
    soinEnBase = soinPlanifie({ produitId: 'produit-fictif' })
    correctionConcurrente({ produitId: null })
    const { status, corps } = await valider(surface)
    expect(status).toBe(422)
    expect(corps.delaisManquants).toEqual(['viande'])
    rienEcritSousVerrou()
  })

  it('concurrence : cible changée pour une vache laitière avant le verrou → lait exigé, rien d’écrit', async () => {
    soinEnBase = soinPlanifie({ tempsAttenteViandeJ: 3 })
    correctionConcurrente({ animalId: 9 })
    db.animal.findFirst.mockImplementation(async ({ where }) => {
      if (where.userId !== 'ferme-a') return null
      return where.id === 7 ? BOVIN_MALE : where.id === 9 ? { ...VACHE_LAITIERE, id: 9 } : null
    })
    const { status, corps } = await valider(surface)
    expect(status).toBe(422)
    expect(corps.delaisManquants).toEqual(['lait'])
    expect(db.animal.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 9, userId: 'ferme-a' } }))
    rienEcritSousVerrou()
  })

  it('concurrence : délai viande corrigé de 3 à 5 avant le verrou → fenêtre calculée sur 5', async () => {
    soinEnBase = soinPlanifie({ tempsAttenteViandeJ: 3 })
    correctionConcurrente({ tempsAttenteViandeJ: 5 })
    const { status } = await valider(surface)
    expect(status).toBe(200)
    expect(soinEnBase).toMatchObject({ fait: true, tempsAttenteViandeJ: 5, finAttenteViande: new Date('2026-11-15T08:00:00Z') })
  })

  it('concurrence : soin validé ailleurs avant le verrou → pas de second contrôle ni refus', async () => {
    soinEnBase = soinPlanifie({ tempsAttenteViandeJ: 3 })
    correctionConcurrente({ fait: true })
    const { status } = await valider(surface)
    expect(status).toBe(200)
  })
})

describe('ADV88 — PATCH /api/elevage/soins : hors passage à « fait », comportement inchangé', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.user = { id: 'ferme-a', acteurId: 'ferme-a' }
    db.$queryRaw.mockResolvedValue([{ ...INJECTION_1, statut: 'realisee', dateRealisee: DATE_SOIN }])
    db.$executeRaw.mockResolvedValue(1)
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db))
    db.animal.findFirst.mockResolvedValue(BOVIN_MALE)
  })

  it('corriger les notes d’un soin déjà fait sans délai (ancienne donnée) reste possible', async () => {
    const existant = soinPlanifie({ fait: true })
    db.soinAnimal.findFirst.mockResolvedValue(existant)
    db.soinAnimal.update.mockImplementation(async ({ data }) => ({ ...existant, ...data }))
    const r = await PATCH_SOIN(new NextRequest('http://localhost/api/elevage/soins', {
      method: 'PATCH', body: JSON.stringify({ id: 1, fait: true, notes: 'note' }), headers: { 'content-type': 'application/json' },
    }))
    expect(r.status).toBe(200)
  })

  it('la cible et le type finaux du corps sont ceux contrôlés', async () => {
    db.soinAnimal.findFirst.mockResolvedValue(soinPlanifie({ type: 'Tonte', tempsAttenteViandeJ: 2 }))
    db.lotAnimaux.findFirst.mockResolvedValue(LOT_PONDEUSES)
    const r = await PATCH_SOIN(new NextRequest('http://localhost/api/elevage/soins', {
      method: 'PATCH', body: JSON.stringify({ id: 1, fait: true, type: 'Vermifuge', lotId: 8 }), headers: { 'content-type': 'application/json' },
    }))
    expect(r.status).toBe(422)
    expect((await r.json()).delaisManquants).toEqual(['oeufs'])
    expect(db.soinAnimal.update).not.toHaveBeenCalled()
  })
})
