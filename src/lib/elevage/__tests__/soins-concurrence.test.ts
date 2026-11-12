/**
 * Revue Codex CR-SOI-01 (2026-11-12) : la suppression d'un soin et la
 * réouverture d'une injection décidaient sur une lecture faite AVANT le
 * verrou des écritures de soins. Une administration réalisée entre-temps par
 * une autre requête était ensuite défaite sans nature, motif ni journal.
 * Règlement (UE) 2019/6, art. 108 ; arrêté du 5 juin 2000, art. 7 et 11.
 *
 * Simulation : hors verrou, le soin est encore « à faire » ; sous le verrou,
 * l'état relu est « administré ».
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verrou: vi.fn(),
  supprime: vi.fn(),
  journal: vi.fn(),
  update: vi.fn(),
  executeRaw: vi.fn(),
}))

const planifie = {
  id: 41, userId: 'u1', animalId: 7, lotId: null, fait: false, date: new Date('2026-11-12T08:00:00Z'),
  datePrevue: null, quantitePreleveeStock: 0, stockMedicamentId: null, finAttenteLait: null, quantite: null,
}
const administre = { ...planifie, fait: true, quantitePreleveeStock: 10, stockMedicamentId: 'stock-1', finAttenteLait: new Date('2026-11-18T08:00:00Z') }

vi.mock('@/lib/prisma', () => {
  const tx = {
    $executeRaw: (...a: unknown[]) => { mocks.executeRaw(...a); return Promise.resolve(1) },
    $queryRaw: async () => [{ id: 'inj-1', numero: 1, datePrevue: new Date('2026-11-12T08:00:00Z'), dateRealisee: new Date('2026-11-12T08:00:00Z'), statut: 'realisee' }],
    soinAnimal: { findFirst: async () => ({ ...administre }), delete: mocks.supprime, update: mocks.update },
    injectionSoin: { findMany: async () => [{ numero: 1, datePrevue: new Date('2026-11-12T08:00:00Z'), dateRealisee: new Date('2026-11-12T08:00:00Z'), statut: 'realisee' }] },
    annulationSoinAnimal: { create: mocks.journal },
    stockMedicamentElevage: { findFirst: async () => ({ quantite: 5, notes: null }), update: vi.fn() },
  }
  return {
    default: {
      // Lectures HORS verrou : le soin et l'injection sont encore à faire.
      soinAnimal: { findFirst: async () => ({ ...planifie }) },
      injectionSoin: { findMany: async () => [] },
      $queryRaw: async () => [{ id: 'inj-1', numero: 1, datePrevue: new Date('2026-11-12T08:00:00Z'), dateRealisee: null, statut: 'a_faire' }],
      $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
    },
  }
})
vi.mock('@/lib/auto-compta', () => ({ deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/elevage/attente-lait', () => ({ ciblesLaitAffectees: vi.fn(async () => []), resyncEcartementLait: vi.fn() }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))

import { supprimerSoin } from '../suppression-soin'
import { daterInjection } from '../injections-protocole'

beforeEach(() => vi.clearAllMocks())

describe('CR-SOI-01 : décision prise sous le verrou des écritures de soins', () => {
  it("suppression d'un soin administré entre la lecture et la transaction : refusée sans motif, rien n'est supprimé", async () => {
    const res = await supprimerSoin('u1', 41)
    expect(res.ok).toBe(false)
    expect(res).toMatchObject({ status: 409 })
    expect(mocks.supprime).not.toHaveBeenCalled()
    // Le verrou est pris avant toute décision.
    expect(String(mocks.executeRaw.mock.calls[0]?.[0])).toContain('pg_advisory_xact_lock')
  })

  it('avec erreur de saisie motivée : journalisé avant la suppression', async () => {
    const res = await supprimerSoin('u1', 41, { annulation: { nature: 'erreur_saisie', motif: 'Saisi sur le mauvais animal' } })
    expect(res.ok).toBe(true)
    expect(mocks.journal).toHaveBeenCalledTimes(1)
    expect(mocks.journal.mock.invocationCallOrder[0]).toBeLessThan(mocks.supprime.mock.invocationCallOrder[0])
  })

  it("réouverture d'une injection réalisée entre-temps : refusée sans motif, aucune écriture", async () => {
    const res = await daterInjection('u1', 41, { numero: 1, statut: 'a_faire' })
    expect(res.ok).toBe(false)
    expect(res).toMatchObject({ status: 409 })
    // Seul le verrou a été exécuté : aucun UPDATE de l'injection.
    expect(mocks.executeRaw.mock.calls.every((c) => String(c[0]).includes('pg_advisory_xact_lock'))).toBe(true)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
