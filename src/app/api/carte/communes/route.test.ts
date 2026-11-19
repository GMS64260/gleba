import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), upsert: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: { genericCache: mocks } }))

import { __resetEtatsMemoire } from '@/lib/cache-helper'
import { GET } from './route'

const HEURE = 60 * 60_000
const communes = [{ nom: 'Commune de test', code: '00001', codesPostaux: ['00000'], centre: { type: 'Point', coordinates: [1, 46] } }]
const lignes = new Map<string, { key: string; data: unknown; expiresAt: Date }>()
const reseau = vi.fn<typeof fetch>()

function rechercher(q?: string) {
  const params = q === undefined ? '' : `?q=${encodeURIComponent(q)}`
  return GET(new NextRequest(`http://localhost/api/carte/communes${params}`))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-19T06:00:00Z'))
  __resetEtatsMemoire()
  lignes.clear()
  mocks.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => lignes.get(where.key) ?? null)
  mocks.upsert.mockImplementation(async ({ create }: { create: { key: string; data: unknown; expiresAt: Date } }) => {
    lignes.set(create.key, create)
    return create
  })
  reseau.mockReset()
  vi.stubGlobal('fetch', reseau)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET communes — cache et panne amont', () => {
  it('sert le tableau connu depuis le cache périmé pendant une panne 503, avec recul borné', async () => {
    reseau.mockResolvedValueOnce(Response.json(communes))
    expect(await (await rechercher('Besançon')).json()).toEqual(communes)
    for (const ligne of lignes.values()) ligne.expiresAt = new Date(Date.now() - HEURE)
    reseau.mockResolvedValue(new Response('<html>maintenance confidentielle</html>', { status: 503 }))

    const stale = await rechercher('Besançon')
    expect(stale.status).toBe(200)
    expect(await stale.json()).toEqual(communes)
    const ligne = [...lignes.values()][0]
    expect(ligne.key).toContain('nom,code,codesPostaux,centre')
    expect(await (await rechercher('Besançon')).json()).toEqual(communes)
    expect(reseau).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(await (await rechercher('Besançon')).json()).toEqual(communes)
    expect(reseau).toHaveBeenCalledTimes(3)
    expect(ligne.expiresAt.getTime()).toBeLessThan(Date.now())
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('<html>')
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('<html>')
  })

  it('sans cache, renvoie 502 et une erreur explicite, avec recul sans faux tableau vide', async () => {
    const text = vi.fn()
    reseau.mockResolvedValue({ ok: false, status: 503, text } as unknown as Response)
    for (let i = 0; i < 2; i++) {
      const response = await rechercher('Inconnue')
      expect(response.status).toBe(502)
      expect(await response.json()).toEqual({ error: "L'API Geo est temporairement indisponible" })
    }
    expect(reseau).toHaveBeenCalledTimes(1)
    expect(text).not.toHaveBeenCalled()
    expect(lignes.size).toBe(0)
  })

  it('ne sert plus le périmé après les 24 h de grâce, même pendant le recul', async () => {
    reseau.mockResolvedValueOnce(Response.json(communes))
    await rechercher('Besançon')
    const ligne = [...lignes.values()][0]
    ligne.expiresAt = new Date(Date.now() - 24 * HEURE + 60_000)
    reseau.mockResolvedValue(new Response(null, { status: 503 }))
    expect((await rechercher('Besançon')).status).toBe(200)
    await vi.advanceTimersByTimeAsync(60_000)
    expect((await rechercher('Besançon')).status).toBe(502)
    expect(reseau).toHaveBeenCalledTimes(2)
  })

  it('sépare les requêtes distinctes et partage les variantes normalisées', async () => {
    const autres = [{ ...communes[0], code: '00002' }]
    reseau.mockResolvedValueOnce(Response.json(communes)).mockResolvedValueOnce(Response.json(autres))
    expect(await (await rechercher('  Besançon  ')).json()).toEqual(communes)
    expect(await (await rechercher('Autre')).json()).toEqual(autres)
    expect(await (await rechercher('BESANC\u0327ON')).json()).toEqual(communes)
    expect(reseau).toHaveBeenCalledTimes(2)
    expect(lignes.size).toBe(2)
    const [url, options] = reseau.mock.calls[0]
    expect(new URL(String(url)).searchParams.get('fields')).toBe('nom,code,codesPostaux,centre')
    expect(options?.cache).toBe('no-store')
  })

  it('coalesce les appels simultanés pour une même requête', async () => {
    let terminer!: (response: Response) => void
    reseau.mockReturnValue(new Promise<Response>((resolve) => { terminer = resolve }))
    const a = rechercher('Besançon')
    const b = rechercher('Besançon')
    await vi.advanceTimersByTimeAsync(0)
    expect(reseau).toHaveBeenCalledTimes(1)
    terminer(Response.json(communes))
    expect(await (await a).json()).toEqual(communes)
    expect(await (await b).json()).toEqual(communes)
    expect(mocks.upsert).toHaveBeenCalledTimes(1)
  })

  it.each(['connexion', 'corps'] as const)('borne réellement à 10 s la lecture (%s) et libère les appels en vol', async (phase) => {
    const suspendue = new Promise<Response>(() => {})
    if (phase === 'connexion') reseau.mockReturnValue(suspendue)
    else reseau.mockResolvedValue({ ok: true, json: () => new Promise(() => {}) } as unknown as Response)
    let terminee = false
    const attente = rechercher('Besançon').then((response) => { terminee = true; return response })
    await vi.advanceTimersByTimeAsync(9_999)
    expect(terminee).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(terminee).toBe(true)
    const response = await attente
    expect(response.status).toBe(504)
    expect(await response.json()).toEqual({ error: "L'API Geo n'a pas répondu dans le délai imparti" })
    expect(reseau.mock.calls[0][1]?.signal?.aborted).toBe(true)
    expect((await rechercher('Besançon')).status).toBe(504)
    expect(reseau).toHaveBeenCalledTimes(1)
    expect(lignes.size).toBe(0)
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    reseau.mockResolvedValue(Response.json(communes))
    expect(await (await rechercher('Besançon')).json()).toEqual(communes)
    expect(reseau).toHaveBeenCalledTimes(2)
  })

  it('conserve l’erreur réseau 502', async () => {
    reseau.mockRejectedValue(new TypeError('fetch failed'))
    const response = await rechercher('Besançon')
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: "Impossible de contacter l'API Geo" })
  })

  it('ne journalise pas le contenu d’une réponse JSON illisible et ne la cache pas', async () => {
    reseau.mockResolvedValue(new Response('<html>maintenance confidentielle</html>', { status: 200 }))
    expect((await rechercher('Besançon')).status).toBe(500)
    expect(lignes.size).toBe(0)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('maintenance confidentielle')
  })

  it.each([undefined, '', '  ', ' a '])('refuse une entrée invalide %j avant tout accès réseau ou cache', async (q) => {
    const response = await rechercher(q)
    expect(response.status).toBe(400)
    expect(await response.json()).toHaveProperty('error')
    expect(reseau).not.toHaveBeenCalled()
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })
})
