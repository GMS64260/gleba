// Régressions de la revue : routes réelles, stockage entièrement en mémoire.
// Aucun chargement d'environnement, client SQL, compte ou service externe.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  auth: vi.fn(), transaction: vi.fn(), execute: vi.fn(), query: vi.fn(),
  animalAvant: vi.fn(), animalTx: vi.fn(), animalUpdate: vi.fn(), animalUpdateMany: vi.fn(),
  venteAvant: vi.fn(), venteTx: vi.fn(), venteCreate: vi.fn(), venteUpdate: vi.fn(),
  miroir: vi.fn(), deleteMiroir: vi.fn(), creerFacture: vi.fn(), annulerFacture: vi.fn(),
  oeufsSync: vi.fn(), oeufsDelete: vi.fn(), rucheSync: vi.fn(), rucheDelete: vi.fn(),
  mouvementFromage: vi.fn(), lotFromage: vi.fn(), pointage: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: m.auth }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({ createVenteFromVenteProduit: m.miroir, deleteAutoEntry: m.deleteMiroir }))
vi.mock('@/lib/facture-utils', () => ({ creerFacture: m.creerFacture, annulerFactureLiee: m.annulerFacture }))
vi.mock('@/lib/comptabilite/projection-reglements', () => ({ enrichirVentesElevageReglements: vi.fn() }))
vi.mock('@/lib/comptabilite/suivi-ecriture', () => ({ chargerSuiviDesSources: vi.fn(), cleSource: vi.fn() }))
vi.mock('@/lib/comptabilite/suivi-reglement-source', () => ({ verifierPointageDetaille: m.pointage }))
vi.mock('@/lib/elevage/stock-oeufs-vente', () => ({
  StockOeufsVenteError: class extends Error {}, synchroniserStockOeufsVente: m.oeufsSync,
  supprimerStockOeufsVente: m.oeufsDelete,
}))
vi.mock('@/lib/elevage/stock-ruche', () => ({
  StockRucheError: class extends Error {}, synchroniserStockRucheVente: m.rucheSync,
  supprimerStockRucheVente: m.rucheDelete,
}))
vi.mock('@/lib/prisma', () => ({ default: {
  animal: { findFirst: m.animalAvant }, venteProduit: { findFirst: m.venteAvant },
  lotFromage: { findFirst: m.lotFromage },
  $transaction: m.transaction,
} }))

import { POST, PATCH, DELETE } from '@/app/api/elevage/ventes/route'

const tx = {
  $executeRaw: m.execute, $queryRaw: m.query,
  animal: { findFirst: m.animalTx, update: m.animalUpdate, updateMany: m.animalUpdateMany },
  venteProduit: { findFirst: m.venteTx, create: m.venteCreate, update: m.venteUpdate },
  mouvementFromage: { create: m.mouvementFromage, deleteMany: vi.fn() },
  lotFromage: { findFirst: m.lotFromage },
}
const request = (method: string, body?: object, query = '') => new NextRequest(
  `http://local.test/api/elevage/ventes${query}`, {
    method,
    ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  },
)
const venteInitiale = () => ({
  id: 11, userId: 'review', date: new Date('2026-10-28T10:00:00Z'), type: 'oeufs',
  quantite: 12, unite: 'unite', prixUnitaire: 1, prixTotal: 12, client: 'Client test',
  paye: false, annule: false, factureId: null, animalId: null, lotFromageId: null,
  tauxTVA: 5.5, notes: null, description: null, destinationId: null,
})
let courante: ReturnType<typeof venteInitiale>
let animal: { id: number; statut: string; dateSortie?: Date | null; causeSortie?: string | null }
let creees: Record<string, unknown>[]
let tail: Promise<unknown>

beforeEach(() => {
  vi.resetAllMocks()
  courante = venteInitiale()
  animal = { id: 501, statut: 'actif' }
  creees = []
  tail = Promise.resolve()
  m.auth.mockResolvedValue({ error: null, session: { user: { id: 'review' } } })
  m.pointage.mockResolvedValue({})
  m.query.mockResolvedValue([])
  m.execute.mockResolvedValue(1)
  m.annulerFacture.mockResolvedValue({ ok: true })
  m.venteAvant.mockImplementation(async () => structuredClone(courante))
  m.venteTx.mockImplementation(async () => structuredClone(courante))
  m.venteUpdate.mockImplementation(async ({ data }) => {
    Object.assign(courante, data)
    return structuredClone(courante)
  })
  m.venteCreate.mockImplementation(async ({ data }) => {
    const ligne = { id: 100 + creees.length, ...data }
    creees.push(ligne)
    return structuredClone(ligne)
  })
  m.animalAvant.mockImplementation(async () => structuredClone(animal))
  m.animalTx.mockImplementation(async () => structuredClone(animal))
  m.animalUpdate.mockImplementation(async ({ data }) => { Object.assign(animal, data); return structuredClone(animal) })
  m.animalUpdateMany.mockImplementation(async ({ where, data }) => {
    if (!where.statut || where.statut === animal.statut) Object.assign(animal, data)
    return { count: 1 }
  })
  // Sérialisation plus forte que PostgreSQL : les transactions entières sont
  // séquentielles. Une anomalie persistante ne dépend donc pas d'un faux mutex.
  m.transaction.mockImplementation((fn) => {
    const run = tail.then(() => fn(tx))
    tail = run.then(() => undefined, () => undefined)
    return run
  })
})

describe('Fiabilité des ventes élevage', () => {
  it('P1 : refuse de convertir une vente d’œufs en fromage sans modifier le stock', async () => {
    const res = await PATCH(request('PATCH', { id: 11, type: 'fromage', unite: 'piece' }))
    expect(res.status).toBe(409)
    expect(courante.type).toBe('oeufs')
    expect(m.oeufsDelete).not.toHaveBeenCalled()
    expect(m.mouvementFromage).not.toHaveBeenCalled()
    expect(m.miroir).not.toHaveBeenCalled()
  })

  it('P1 : refuse la conversion d’un animal et le réintègre à l’annulation', async () => {
    Object.assign(courante, { type: 'animal_vivant', quantite: 1, animalId: 501 })
    animal.statut = 'vendu'
    expect((await PATCH(request('PATCH', { id: 11, type: 'autre' }))).status).toBe(409)
    expect((await DELETE(request('DELETE', undefined, '?id=11'))).status).toBe(200)
    expect(courante.annule).toBe(true)
    expect(animal.statut).toBe('actif')
  })

  it('P1 : une seule de deux ventes du même animal réussit', async () => {
    let lus = 0
    let liberer!: () => void
    const porte = new Promise<void>((resolve) => { liberer = resolve })
    m.animalAvant.mockImplementation(async () => {
      const snapshot = structuredClone(animal)
      if (++lus === 2) liberer()
      await porte
      return snapshot
    })
    const body = { type: 'animal_vivant', animalId: 501, quantite: 1, unite: 'unite',
      prixUnitaire: 100, paye: false, client: 'Client test', validationVente: true }
    const reponses = await Promise.all([POST(request('POST', body)), POST(request('POST', body))])
    expect(reponses.map((r) => r.status).sort()).toEqual([201, 409])
    expect(creees).toHaveLength(1)
    expect(creees.reduce((s, v) => s + Number(v.prixTotal), 0)).toBe(100)
    expect(m.miroir).toHaveBeenCalledTimes(1)
    expect(animal.statut).toBe('vendu')
  })

  it('P1 : annulation attendant le mutex relit une facture créée entretemps', async () => {
    let lu!: () => void
    const lecture = new Promise<void>((resolve) => { lu = resolve })
    let liberer!: () => void
    tail = new Promise<void>((resolve) => { liberer = resolve })
    m.venteAvant.mockImplementation(async () => {
      const snapshot = structuredClone(courante)
      lu()
      return snapshot
    })
    const annulation = DELETE(request('DELETE', undefined, '?id=11'))
    await lecture
    // Une facturation détient le même mutex et commit avant DELETE.
    Object.assign(courante, { factureId: 77 })
    liberer()
    expect((await annulation).status).toBe(200)
    expect(courante.annule).toBe(true)
    expect(courante.factureId).toBe(77)
    expect(m.annulerFacture).toHaveBeenCalledWith(tx, 'review', 77)
    expect(m.oeufsDelete).toHaveBeenCalled()
  })
})
