// Contre-exemples de revue : routes réelles et données synthétiques en mémoire.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  auth: vi.fn(), transaction: vi.fn(), execute: vi.fn(),
  lot: vi.fn(), lotUpdate: vi.fn(), animal: vi.fn(), animalUpdate: vi.fn(),
  abattageAvant: vi.fn(), abattageCreate: vi.fn(), abattageUpdate: vi.fn(),
  soins: vi.fn(), effectifs: vi.fn(), miroir: vi.fn(), facture: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: m.auth }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({ createVenteFromAbattage: m.miroir, deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/facture-utils', () => ({ creerFacture: m.facture, annulerFactureLiee: vi.fn() }))
vi.mock('@/lib/elevage/effectif', () => ({ reconstituerEffectifsLots: m.effectifs }))
vi.mock('@/lib/prisma', () => ({ default: {
  lotAnimaux: { findFirst: m.lot }, animal: { findFirst: m.animal },
  abattage: { findFirst: m.abattageAvant }, soinAnimal: { findMany: m.soins },
  $transaction: m.transaction,
} }))

import { POST, PATCH, DELETE } from '@/app/api/elevage/abattages/route'

const tx = {
  $executeRaw: m.execute, $queryRaw: vi.fn().mockResolvedValue([]),
  soinAnimal: { findMany: m.soins },
  venteManuelle: { findFirst: vi.fn().mockResolvedValue(null) },
  lotAnimaux: { findFirst: m.lot, update: m.lotUpdate },
  animal: { findFirst: m.animal, update: m.animalUpdate },
  abattage: { create: m.abattageCreate, update: m.abattageUpdate, findFirst: async () => Object.fromEntries(Object.entries(await m.abattageAvant()).filter(([k]) => k !== 'animal' && k !== 'lot')) },
}
const request = (method: string, body: object) => new NextRequest('http://local.test/api/elevage/abattages', {
  method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})
let lot: { id: number; nom: string; quantiteInitiale: number; quantiteActuelle: number; statut: string }
let courante: Record<string, unknown>
let creees: Record<string, unknown>[]
let animal: { id: number; lotId: number; statut: string }
let tail: Promise<unknown>

beforeEach(() => {
  vi.resetAllMocks()
  tail = Promise.resolve()
  lot = { id: 71, nom: 'Lot synthétique', quantiteInitiale: 6, quantiteActuelle: 6, statut: 'actif' }
  animal = { id: 501, lotId: 71, statut: 'actif' }
  courante = { id: 31, userId: 'review', lotId: null, animalId: 501, date: new Date('2026-10-31T12:00:00Z'),
    quantite: 1, prixVente: 100, destination: 'vente', factureId: null, annule: false, animal: { id: 501 }, lot: null }
  creees = []
  m.auth.mockResolvedValue({ error: null, session: { user: { id: 'review' } } })
  m.execute.mockResolvedValue(1)
  tx.$queryRaw.mockResolvedValue([])
  tx.venteManuelle.findFirst.mockResolvedValue(null)
  m.soins.mockResolvedValue([])
  m.lot.mockImplementation(async () => structuredClone(lot))
  m.lotUpdate.mockImplementation(async ({ data }) => { Object.assign(lot, data); return structuredClone(lot) })
  m.effectifs.mockImplementation(async () => new Map([[71, {
    effectifCalcule: lot.quantiteActuelle, effectifCollectif: lot.quantiteActuelle, nominatifsActifs: 0,
  }]]))
  m.animal.mockImplementation(async () => structuredClone(animal))
  m.animalUpdate.mockImplementation(async ({ data }) => { Object.assign(animal, data); return structuredClone(animal) })
  m.abattageAvant.mockImplementation(async () => structuredClone(courante))
  m.abattageUpdate.mockImplementation(async ({ data }) => { Object.assign(courante, data); return structuredClone(courante) })
  m.abattageCreate.mockImplementation(async ({ data }) => {
    const ligne = { id: 100 + creees.length, ...data, animal: null, lot: null }
    creees.push(ligne)
    return structuredClone(ligne)
  })
  m.transaction.mockImplementation((fn) => {
    const run = tail.then(() => fn(tx))
    tail = run.then(() => undefined, () => undefined)
    return run
  })
})

describe('Fiabilité des abattages', () => {
  it('P1 : refuse de changer le prix d’un abattage facturé', async () => {
    courante.factureId = 77
    const res = await PATCH(request('PATCH', { id: 31, prixVente: 200 }))
    expect(res.status).toBe(409)
    expect(courante).toMatchObject({ factureId: 77, prixVente: 100 })
    expect(m.facture).not.toHaveBeenCalled()
  })

  it('P1 : abattre un animal consulte aussi le soin viande de son lot', async () => {
    // Le soin couvre le lot, du 25 au 30 octobre. L’animal est dans ce lot.
    const soin = { id: 80, animalId: null, lotId: 71, fait: true, type: 'traitement',
      date: new Date('2026-10-25'), finAttenteViande: new Date('2026-10-30'), produitVeterinaire: null }
    m.soins.mockResolvedValue([soin])
    const res = await POST(request('POST', { animalId: 501, date: '2026-10-28', quantite: 1, destination: 'vente', prixVente: 100 }))
    expect(res.status).toBe(409)
    expect(animal.statut).toBe('actif')
    expect(m.abattageCreate).not.toHaveBeenCalled()
  })

  it('P1 : refuse d’antidater un abattage dans une attente viande', async () => {
    m.soins.mockResolvedValue([{ id: 80, animalId: 501, lotId: null, date: new Date('2026-10-25'), type: 'traitement', finAttenteViande: new Date('2026-10-30') }])
    const res = await PATCH(request('PATCH', { id: 31, date: '2026-10-28' }))
    expect(res.status).toBe(409)
    expect(new Date(courante.date as Date).toISOString()).toBe('2026-10-31T12:00:00.000Z')
    expect(m.abattageUpdate).not.toHaveBeenCalled()
  })

  // Revue du 2026-10-29 — le PATCH rejouait l'attente viande à chaque
  // correction : un soin saisi après coup bloquait un poids ou une note.
  it('corrige le poids et la note malgré un soin saisi après coup, date renvoyée au même jour', async () => {
    m.soins.mockResolvedValue([{ id: 81, animalId: 501, lotId: null, date: new Date('2026-10-29'), type: 'traitement', finAttenteViande: new Date('2026-11-05') }])
    // Corps du crayon d'Élevage > Production > Abattages : jour seul affiché.
    const res = await PATCH(request('PATCH', { id: 31, date: '2026-10-31', quantite: 1, poidsCarcasse: 42, destination: 'vente', prixVente: 100, notes: 'Pesée corrigée' }))
    expect(res.status).toBe(200)
    expect(courante).toMatchObject({ poidsCarcasse: 42, notes: 'Pesée corrigée' })
    expect(new Date(courante.date as Date).toISOString()).toBe('2026-10-31T12:00:00.000Z')
    expect(m.soins).not.toHaveBeenCalled()
  })

  it('P1 : deux abattages de 4 têtes ne consomment jamais plus des 6 disponibles', async () => {
    const body = { lotId: 71, date: '2026-10-28', quantite: 4, destination: 'auto_consommation' }
    const reponses = await Promise.all([POST(request('POST', body)), POST(request('POST', body))])
    expect(reponses.map((r) => r.status).sort()).toEqual([201, 422])
    expect(creees.reduce((s, ligne) => s + Number(ligne.quantite), 0)).toBe(4)
    expect(lot.quantiteActuelle).toBe(2)
  })

  it('deux annulations concurrentes ne rendent les têtes au lot qu’une seule fois', async () => {
    Object.assign(courante, { animalId: null, lotId: 71, quantite: 2 })
    lot.quantiteActuelle = 4
    const req = () => new NextRequest('http://local.test/api/elevage/abattages?id=31', { method: 'DELETE' })
    const reponses = await Promise.all([DELETE(req()), DELETE(req())])
    expect(reponses.map((r) => r.status).sort()).toEqual([200, 409])
    expect(lot.quantiteActuelle).toBe(6)
    expect(courante.annule).toBe(true)
  })

  it('une facture reprend le statut non encaissé et ne suppose aucun paiement en espèces', async () => {
    tx.venteManuelle.findFirst.mockResolvedValue({ paye: false, modeReglement: null })
    m.facture.mockResolvedValue({ id: 77 })
    const res = await PATCH(request('PATCH', { id: 31, creerFacture: true, tauxTVA: 0 }))
    expect(res.status).toBe(200)
    expect(m.facture).toHaveBeenCalledWith(tx, expect.objectContaining({ statut: 'emise', datePaiement: null, modePaiement: null, totalTVA: 0 }))
  })

  // Décision du 2026-10-30 : sans pointage contraire, la vente d'abattage et
  // sa facture sont présumées réglées, comme avant le 2026-10-28.
  it.each([
    ['miroir présumé payé', { paye: true, modeReglement: 'Chèque' }, 'cheque'],
    ['sans miroir', null, null],
  ])('une facture d’abattage %s est émise réglée, sans mode inventé', async (_cas, suivi, mode) => {
    tx.venteManuelle.findFirst.mockResolvedValue(suivi)
    m.facture.mockResolvedValue({ id: 77 })
    const res = await PATCH(request('PATCH', { id: 31, creerFacture: true }))
    expect(res.status).toBe(200)
    expect(m.facture).toHaveBeenCalledWith(tx, expect.objectContaining({ statut: 'payee', datePaiement: expect.any(Date), modePaiement: mode }))
  })
})
