import { beforeEach, describe, expect, it, vi } from 'vitest'
import { delegueMemoire, MOI, AUTRE } from '@/lib/__tests__/fixtures/referentiel-memoire'
const m = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), photo: vi.fn(), db: {} as Record<string, unknown> }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: m.auth }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => null }))
vi.mock('@/lib/prisma', () => ({ default: m.db }))
import { GET } from './route'
const photoId = '65d8714b-5856-479d-9e56-3889328cb67d'
const params = () => ({ params: Promise.resolve({ avisId: 'avis', photoId }) })
const request = () => new Request('http://localhost/api/avis/photos/avis/'+photoId)
beforeEach(() => {
  vi.resetAllMocks()
  m.auth.mockResolvedValue({ error: null, session: { user: { id: MOI, acteurId: MOI, role: 'USER' } } })
  m.user.mockResolvedValue({ id: MOI, email: 'test@example.test', active: true, role: 'USER' })
  m.db.user = { findUnique: m.user }; m.db.photoAvis = { findUnique: m.photo }
  m.db.espece = delegueMemoire([{ id: 'espece', userId: null, partageCommunaute: false }])
  m.photo.mockImplementation(({ select }: { select: { donnees?: boolean } }) => Promise.resolve(select.donnees ? { donnees: Buffer.from([255,216,255,217]) } : { avis: { id: 'avis', refType: 'ESPECE', refId: 'espece' }, temoignage: null }))
})
describe('lecture privée des images communautaires', () => {
  it('refuse anonyme et démo avant la lecture des photos', async () => {
    m.auth.mockResolvedValueOnce({ error: new Response(null, { status: 401 }), session: null })
    const anonyme = await GET(request(), params())
    expect(anonyme.status).toBe(401); expect(anonyme.headers.get('cache-control')).toBe('private, no-store')
    m.user.mockResolvedValue({ id: MOI, email: 'demo@gleba.fr', active: true, role: 'USER' })
    expect((await GET(request(), params())).status).toBe(403); expect(m.photo).not.toHaveBeenCalled()
  })
  it('sert seulement le binaire autorisé avec des en-têtes sans cache public', async () => {
    const response = await GET(request(), params())
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('vary')).toBe('Cookie')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([255,216,255,217]))
    expect(m.photo.mock.calls[0][0].select).not.toHaveProperty('donnees'); expect(m.photo.mock.calls[1][0].select).toEqual({ donnees: true })
  })
  it('refuse les octets si la référence ou son parent deviennent privés', async () => {
    m.photo.mockResolvedValue({ avis: null, temoignage: { avis: { id: 'avis', refType: 'VARIETE', refId: 'variete' } } })
    m.db.variete = delegueMemoire([{ id: 'variete', userId: null, partageCommunaute: false, espece: { userId: AUTRE, partageCommunaute: false } }])
    const response = await GET(request(), params())
    expect(response.status).toBe(404); expect(response.headers.get('vary')).toBe('Cookie'); expect(m.photo).toHaveBeenCalledTimes(1)
  })
  it('ne permet pas de lire une photo en inventant un autre parent avis', async () => {
    m.photo.mockResolvedValue({ avis: { id: 'autre-avis', refType: 'ESPECE', refId: 'espece' }, temoignage: null })
    expect((await GET(request(), params())).status).toBe(404); expect(m.photo).toHaveBeenCalledTimes(1)
  })
})
