/**
 * Équipe debug, D56 et D64 : l'administrateur voit la photo qu'il modère.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const m = vi.hoisted(() => ({
  media: null as null | { url: string },
  where: null as null | Record<string, unknown>,
  refus: null as null | number,
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAdminApi: async () =>
    m.refus
      ? { error: NextResponse.json({ error: 'Accès interdit' }, { status: m.refus }), session: null }
      : { error: null, session: { user: { id: 'admin', role: 'ADMIN' } } },
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    mediaReferentiel: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        m.where = where
        return m.media
      },
    },
  },
}))

const UUID = '0f8e4c1a-1b2c-4d3e-8f90-123456789abc'
let racine: string

beforeEach(async () => {
  m.media = { url: `/uploads/referentiel/membre/${UUID}-1200.jpg` }
  m.where = null
  m.refus = null
  racine = await mkdtemp(path.join(os.tmpdir(), 'gleba-d56-'))
  await mkdir(path.join(racine, 'public', 'uploads', 'referentiel', 'membre'), { recursive: true })
  await writeFile(path.join(racine, 'public', 'uploads', 'referentiel', 'membre', `${UUID}-1200.jpg`), Buffer.from([0xff, 0xd8, 0xff]))
  vi.spyOn(process, 'cwd').mockReturnValue(racine)
  return async () => {
    vi.restoreAllMocks()
    await rm(racine, { recursive: true, force: true })
  }
})

const { GET } = await import('./route')
const appeler = (id = 'media-1') =>
  GET(new NextRequest(`http://localhost/api/admin/referentiel/medias/${id}/image`), { params: Promise.resolve({ id }) })

describe('GET /api/admin/referentiel/medias/[id]/image', () => {
  it('sert la photo proposée à un administrateur, sans cache partagé', async () => {
    const res = await appeler()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(m.where).toEqual({ id: 'media-1' })
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff]))
  })

  it('refuse un compte qui n’est pas administrateur, sans lire le média', async () => {
    m.refus = 403
    const res = await appeler()
    expect(res.status).toBe(403)
    expect(m.where).toBeNull()
  })

  it('répond 404 pour un média inconnu ou une adresse hors du dossier du référentiel', async () => {
    m.media = null
    expect((await appeler()).status).toBe(404)
    m.media = { url: '/uploads/justificatifs/../../etc/passwd' }
    expect((await appeler()).status).toBe(404)
  })
})
