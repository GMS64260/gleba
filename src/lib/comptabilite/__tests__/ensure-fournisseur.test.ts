import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ default: {} }))

import { ensureFournisseurForUser } from '../ensure-fournisseur'

/**
 * Revue du 2026-11-04 — la table des fournisseurs est globale : un nom tapé
 * dans une dépense ne doit plus y créer de fiche visible de tous les comptes.
 */
function base(ids: string[]) {
  return {
    fournisseur: {
      findMany: vi.fn(async () => ids.map((id) => ({ id }))),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (ids.includes(where.id) ? { id: where.id } : null)),
      create: vi.fn(),
    },
  }
}

describe('ensureFournisseurForUser', () => {
  it("rattache un nom au fournisseur du référentiel, sans tenir compte de la casse ni des accents", async () => {
    const db = base(['Kokopelli', 'La Ferme de Sainte Marthe'])
    const id = await ensureFournisseurForUser('compte-a', { nom: '  la ferme de sainte marthe ' }, db as never)
    expect(id).toBe('La Ferme de Sainte Marthe')
    expect(db.fournisseur.create).not.toHaveBeenCalled()
  })

  it("ne crée jamais de fiche globale pour un nom inconnu : la dépense garde le nom saisi", async () => {
    const db = base(['Kokopelli'])
    const id = await ensureFournisseurForUser('compte-a', { nom: 'Jean Martin (voisin, foin)' }, db as never)
    expect(id).toBeNull()
    expect(db.fournisseur.create).not.toHaveBeenCalled()
  })

  it("respecte un identifiant choisi s'il existe, et l'ignore sinon", async () => {
    const db = base(['Kokopelli'])
    expect(await ensureFournisseurForUser('compte-a', { fournisseurId: 'Kokopelli' }, db as never)).toBe('Kokopelli')
    expect(await ensureFournisseurForUser('compte-a', { fournisseurId: 'Inconnu' }, db as never)).toBeNull()
  })
})
