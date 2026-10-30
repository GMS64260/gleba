/**
 * DELETE /api/elevage/animaux/[id] — garde des traces du registre d'élevage.
 *
 * Audit 2026-10-08 : la suppression détachait les soins du carnet sanitaire
 * (`SetNull`) et détruisait les mouvements de cheptel (`Cascade`). Désormais
 * 409 tant que l'animal porte une saisie ; une fiche sans trace reste
 * supprimable.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  animalFindFirst: vi.fn(),
  animalDelete: vi.fn(),
  deleteAutoEntry: vi.fn(),
  compterTracesAnimal: vi.fn(),
  executeRaw: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromAchatAnimal: vi.fn(), deleteAutoEntry: mocks.deleteAutoEntry }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/elevage/traces-animal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/elevage/traces-animal')>()),
  compterTracesAnimal: mocks.compterTracesAnimal,
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    // Comme Prisma : la transaction prend le verrou des règlements (`$executeRaw`).
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({ $executeRaw: mocks.executeRaw, animal: { delete: mocks.animalDelete } }),
    animal: { findFirst: mocks.animalFindFirst },
  },
}))

import { DELETE } from './route'

// L'écran Animaux (AnimauxTab, confirmDelete) envoie un DELETE sans corps.
const supprimer = () => DELETE(
  new NextRequest('http://localhost/api/elevage/animaux/7', { method: 'DELETE' }),
  { params: Promise.resolve({ id: '7' }) }
)

const sansTrace = {
  soins: 0,
  mouvements: 0,
  productions: 0,
  naissances: 0,
  descendants: 0,
  saillies: 0,
  ventes: 0,
  abattages: 0,
  consommations: 0,
  pesees: 0,
  testsSante: 0,
  statutsSanitaires: 0,
  justificatifsEquarrissage: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
  mocks.animalFindFirst.mockResolvedValue({ id: 7, nom: 'Noisette', identifiant: null, statut: 'actif' })
})

describe('DELETE /api/elevage/animaux/[id]', () => {
  it('refuse en 409 un animal qui porte des soins et des mouvements, et ne supprime rien', async () => {
    mocks.compterTracesAnimal.mockResolvedValue({ ...sansTrace, soins: 2, mouvements: 1 })

    const res = await supprimer()

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('porte encore 2 soins et 1 mouvement de cheptel')
    expect(json.error).toContain('déclarez plutôt sa sortie')
    expect(json.details).toMatchObject({ soins: 2, mouvements: 1 })
    expect(mocks.compterTracesAnimal).toHaveBeenCalledWith(expect.anything(), 7, 'user-1')
    expect(mocks.animalDelete).not.toHaveBeenCalled()
    expect(mocks.deleteAutoEntry).not.toHaveBeenCalled()
  })

  it('supprime comme avant une fiche sans aucune trace (écriture d’achat comprise)', async () => {
    mocks.compterTracesAnimal.mockResolvedValue(sansTrace)

    const res = await supprimer()

    expect(res.status).toBe(200)
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1)
    expect(mocks.deleteAutoEntry).toHaveBeenCalledWith('achat_animal_individuel', 7, 'depense', 'user-1', expect.anything())
    expect(mocks.animalDelete).toHaveBeenCalledWith({ where: { id: 7 } })
  })

  it('404 pour l’animal d’un autre compte, sans compter ses traces', async () => {
    mocks.animalFindFirst.mockResolvedValue(null)

    const res = await supprimer()

    expect(res.status).toBe(404)
    expect(mocks.compterTracesAnimal).not.toHaveBeenCalled()
  })
})
