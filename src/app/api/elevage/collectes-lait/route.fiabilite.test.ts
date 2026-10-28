// Corps exact de la saisie de traite (saveCollecte, LaitSubTab).
// Route réelle, accès aux données remplacés, aucune connexion PostgreSQL.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  auth: vi.fn(), collecte: vi.fn(), update: vi.fn(), create: vi.fn(), animal: vi.fn(), soin: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: m.auth }))
vi.mock('@/lib/elevage/effectif', () => ({ reconstituerEffectifsLots: vi.fn() }))
vi.mock('@/lib/elevage/attente-lait', () => ({ soinCouvrantCollecte: m.soin, causesAttenteCollectes: vi.fn() }))
vi.mock('@/lib/prisma', () => { const db = {
  animal: { findFirst: m.animal },
  collecteLait: { findFirst: m.collecte, create: m.create, update: m.update },
}; return { default: { ...db, $transaction: (fn: (db: unknown) => unknown) => fn({ ...db, $executeRaw: vi.fn() }) } } })

import { POST } from '@/app/api/elevage/collectes-lait/route'

let collecte: Record<string, unknown>
const corrigerVolume = () => POST(new NextRequest('http://local.test/api/elevage/collectes-lait', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ date: '2026-10-28', traite: 'Matin', animalId: 501, lotId: null,
    quantiteLitres: 2.1, confirmerVolumeInhabituel: false }),
}))

beforeEach(() => {
  vi.resetAllMocks()
  collecte = { id: 'traite-1', userId: 'review', animalId: 501, lotId: null,
    date: new Date('2026-10-28'), traite: 'Matin', quantiteLitres: 2,
    lotFromageId: 'fromage-1', ecarteAttente: false,
    mgGpl: 36, mpGpl: 32, cellulesParMl: 120, notes: 'Analyse saisie' }
  m.auth.mockResolvedValue({ error: null, session: { user: { id: 'review' } } })
  m.soin.mockResolvedValue(null)
  m.animal.mockResolvedValue({ id: 501, sexe: 'femelle', orientationProduction: 'lait',
    especeAnimale: { nom: 'Chèvre', production: 'lait', productions: ['lait'] } })
  m.collecte.mockImplementation(async () => structuredClone(collecte))
  m.update.mockImplementation(async ({ data }) => { Object.assign(collecte, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))); return structuredClone(collecte) })
})

describe('Fiabilité des corrections de traite', () => {
  it('P1 : refuse de corriger le volume d’une collecte déjà transformée', async () => {
    const res = await corrigerVolume()
    expect(res.status).toBe(409)
    expect(collecte).toMatchObject({ quantiteLitres: 2, lotFromageId: 'fromage-1' })
    expect(m.create).not.toHaveBeenCalled()
  })

  it('P1 : corriger le volume conserve l’écartement manuel et les mesures de qualité', async () => {
    collecte.lotFromageId = null
    collecte.ecarteAttente = true
    const res = await corrigerVolume()
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({
      quantiteLitres: 2.1, ecarteAttente: true, mgGpl: 36, mpGpl: 32, cellulesParMl: 120, notes: 'Analyse saisie',
    })
  })
})
