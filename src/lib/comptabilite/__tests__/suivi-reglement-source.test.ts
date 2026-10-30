/**
 * Revue du 2026-10-29 : une pièce dont l'unique versement a été annulé restait
 * « suivie » (son dossier existe toujours) ; elle ne pouvait plus être
 * supprimée, ramenée à 0, ni sa source repassée en planifiée. Un dossier sans
 * versement actif se comporte désormais comme une pièce non suivie pour ces
 * gestes ; un dossier qui porte un versement actif reste protégé.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import {
  suiviReglementActif,
  synchroniserReglementSource,
  verifierSuppressionSourceReglee,
} from '../suivi-reglement-source'

function base(actifs: number, regle = 0) {
  const dossierUpdate = vi.fn()
  const db = {
    $queryRaw: vi.fn(async () => [{ dossier_id: 'dossier-qa', regle: BigInt(regle), actifs: BigInt(actifs) }]),
    cibleReglement: { findFirst: vi.fn(async () => null) },
    dossierReglement: { update: dossierUpdate },
  }
  return { db: db as unknown as Prisma.TransactionClient, dossierUpdate }
}

describe('dossier de règlements sans versement actif', () => {
  it('laisse supprimer la pièce quand tous ses versements sont annulés', async () => {
    await expect(verifierSuppressionSourceReglee(base(0).db, 'u1', 'cle-qa')).resolves.toBeUndefined()
  })
  it('refuse toujours la suppression d’une pièce qui porte un versement actif', async () => {
    await expect(verifierSuppressionSourceReglee(base(1, 5000).db, 'u1', 'cle-qa')).rejects.toMatchObject({ status: 409 })
  })
  it('laisse ramener la pièce à 0 (source repassée en planifiée) sans toucher au dossier', async () => {
    const { db, dossierUpdate } = base(0)
    await expect(synchroniserReglementSource(db, 'u1', 'cle-qa', 0)).resolves.toEqual({})
    expect(dossierUpdate).not.toHaveBeenCalled()
  })
  it('refuse d’effacer le montant d’une pièce réglée, même par un versement et son remboursement', async () => {
    await expect(synchroniserReglementSource(base(2, 0).db, 'u1', 'cle-qa', 0)).rejects.toMatchObject({ status: 409 })
  })
  it('ne présente comme suivi qu’un dossier qui porte un versement actif', async () => {
    expect(await suiviReglementActif(base(0).db, 'u1', 'cle-qa')).toBeNull()
    expect(await suiviReglementActif(base(1, 100).db, 'u1', 'cle-qa')).toMatchObject({ dossierId: 'dossier-qa', regle: 100, actifs: 1 })
  })
})
