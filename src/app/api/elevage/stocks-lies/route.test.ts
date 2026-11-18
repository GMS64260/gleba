import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), stocks: vi.fn(), besoins: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ default: { $transaction: (fn: (tx: object) => unknown) => fn({}) } }))
vi.mock('@/lib/boutique/stock-lie-disponible', () => ({ listerStocksLiables: mocks.stocks, besoinsAProduire: mocks.besoins }))
import { GET as stocks } from './route'
import { GET as besoins } from '../besoins-boutique/route'

describe.each([['stocks', stocks, mocks.stocks], ['besoins', besoins, mocks.besoins]] as const)('%s élevage', (_nom, route, lire) => {
  beforeEach(() => { vi.clearAllMocks() })
  it.each([401, 403])('propage le refus %s sans lire les agrégats', async status => {
    mocks.auth.mockResolvedValue({ error: NextResponse.json({ error: 'Refus' }, { status }), session: null })
    expect((await route()).status).toBe(status)
    expect(lire).not.toHaveBeenCalled()
  })
  it('autorisé : lit seulement le propriétaire, réponse privée et non cachée', async () => {
    mocks.auth.mockResolvedValue({ error: null, session: { user: { id: 'proprietaire', acteurId: 'membre' } } })
    lire.mockResolvedValue([{ type: 'oeufs', ref: 'stock', disponible: 12 }])
    const reponse = await route()
    expect(reponse.status).toBe(200)
    expect(lire).toHaveBeenCalledWith(expect.anything(), 'proprietaire')
    expect(reponse.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await reponse.json()).toEqual([{ type: 'oeufs', ref: 'stock', disponible: 12 }])
  })
})
