import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { verifierAttenteViande } from './attente-viande'

const soin = { animalId: null, lotId: 71, date: new Date('2026-10-25T08:00:00Z'), finAttenteViande: new Date('2026-10-30'), type: 'traitement', produitVeterinaire: null }
const db = { soinAnimal: { findMany: vi.fn() }, animal: { findFirst: vi.fn() }, $queryRaw: vi.fn() }
const verifier = () => verifierAttenteViande(db as unknown as Prisma.TransactionClient, 'ferme', { animalId: 501, lotId: null, date: new Date('2026-10-28') })

beforeEach(() => {
  vi.resetAllMocks()
  db.soinAnimal.findMany.mockResolvedValue([soin])
  db.animal.findFirst.mockResolvedValue({ lotId: 71 })
  db.$queryRaw.mockResolvedValue([])
})

describe('Couverture de l’attente viande', () => {
  it('couvre les membres du lot sans historique disponible', async () => {
    await expect(verifier()).rejects.toMatchObject({ code: 'ATTENTE_VIANDE_ACTIVE' })
  })
  it('conserve l’attente après un changement de lot', async () => {
    db.animal.findFirst.mockResolvedValue({ lotId: 72 })
    db.$queryRaw.mockResolvedValue([{ animalId: 501, lotId: 71, dateDebut: new Date('2026-10-01'), dateFin: new Date('2026-10-26') }])
    await expect(verifier()).rejects.toMatchObject({ code: 'ATTENTE_VIANDE_ACTIVE' })
  })
  it('ne couvre pas un animal arrivé après le soin', async () => {
    db.$queryRaw.mockResolvedValue([{ animalId: 501, lotId: 71, dateDebut: new Date('2026-10-26'), dateFin: null }])
    await expect(verifier()).resolves.toBeUndefined()
  })
  it('ignore les soins individuels des autres animaux pour une sortie collective anonyme', async () => {
    db.soinAnimal.findMany.mockResolvedValue([{ ...soin, lotId: null, animalId: 502 }])
    await expect(verifierAttenteViande(db as unknown as Prisma.TransactionClient, 'ferme', { animalId: null, lotId: 71, date: new Date('2026-10-28') })).resolves.toBeUndefined()
  })
})
