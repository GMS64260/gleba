import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { livraisonLaitSchema } from '@/lib/validations/livraison-lait'

const m = vi.hoisted(() => ({ auth: vi.fn(), create: vi.fn(), verifier: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: m.auth }))
vi.mock('@/lib/prisma', () => ({ default: { livraisonLait: { create: m.create } } }))
vi.mock('@/lib/elevage/bilan-lait', async (original) => ({
  ...(await original<typeof import('@/lib/elevage/bilan-lait')>()),
  verifierDisponibiliteLait: m.verifier,
}))

import { POST } from './route'

describe('validation livraison lait', () => {
  it('accepte des analyses plausibles (cellules/germes en ×10³/mL)', () => {
    // Convention canonique : milliers/mL (650 = 650 000 cellules/mL, 12 = 12 000 germes/mL).
    expect(livraisonLaitSchema.safeParse({ date: '2026-07-21', litres: 120, tb: 38, tp: 32, cellules: 650, germes: 12, lipolyse: 0.6 }).success).toBe(true)
  })

  it('refuse une saisie en valeur brute (erreur d’unité)', () => {
    // Valeurs brutes /mL au lieu de milliers/mL → au-delà du garde-fou (20 000).
    expect(livraisonLaitSchema.safeParse({ date: '2026-07-21', litres: 120, cellules: 650000 }).success).toBe(false)
    expect(livraisonLaitSchema.safeParse({ date: '2026-07-21', litres: 120, germes: 500000 }).success).toBe(false)
  })

  it.each(['tb', 'tp', 'cellules', 'germes', 'lipolyse'])('refuse une valeur negative pour %s', (field) => {
    expect(livraisonLaitSchema.safeParse({ date: '2026-07-21', litres: 120, [field]: -1 }).success).toBe(false)
  })
})

describe('POST /api/elevage/livraisons-lait — bilan sur 7 jours (2026-11-03)', () => {
  const livrer = (corps: object) => POST(new NextRequest('http://localhost/api/elevage/livraisons-lait', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: '2026-11-03', litres: 300, ...corps }),
  }))
  const alerte = {
    debut: '2026-10-28', fin: '2026-11-03', collecte: 200, ecarte: 0, livre: 300, venduCru: 0, transforme: 0,
    disponible: 200, sorties: 300, nonAffecte: -100, nbCollectes: 12, ventesHorsLitres: 0, depassement: 100, tolerance: 10,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    m.auth.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
    m.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'l1', ...data }))
    m.verifier.mockResolvedValue(null)
  })

  it('rend un 422 confirmable quand la livraison dépasse la traite', async () => {
    m.verifier.mockResolvedValue(alerte)

    const res = await livrer({})
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json).toMatchObject({ code: 'LAIT_INDISPONIBLE', details: { depassement: 100 } })
    expect(json.error).toContain('livré 300 L')
    expect(m.verifier).toHaveBeenCalledWith(expect.anything(), 'u1', { ajout: [{ jour: '2026-11-03', poste: 'livre', litres: 300 }] })
    expect(m.create).not.toHaveBeenCalled()
  })

  it('enregistre la livraison confirmée sans recontrôler ni stocker la confirmation', async () => {
    const res = await livrer({ confirmerLaitIndisponible: true })

    expect(res.status).toBe(201)
    expect(m.verifier).not.toHaveBeenCalled()
    expect(m.create).toHaveBeenCalledWith({ data: expect.not.objectContaining({ confirmerLaitIndisponible: true }) })
  })

  it('enregistre sans alerte une livraison couverte par la traite', async () => {
    expect((await livrer({})).status).toBe(201)
    expect(m.create).toHaveBeenCalledTimes(1)
  })
})
