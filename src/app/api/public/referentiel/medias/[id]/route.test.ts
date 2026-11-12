/**
 * UI-01 (revue Codex du 2026-11-12) : la galerie publique d'un végétal
 * s'affiche pour un visiteur anonyme.
 *
 * La fiche publique affichait les photos validées avec leur URL de stockage
 * `/uploads/referentiel/{commons,membre}/<uuid>-1200.jpg`. Le middleware exige
 * une session sur `/uploads/*` : un visiteur anonyme recevait un 307 vers
 * /login, et l'optimiseur de Next, qui appelle la source sans cookies, aussi.
 * Les photos VALIDÉES d'un végétal public sont désormais servies par une
 * route publique dédiée ; `/uploads` reste fermé.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const m = vi.hoisted(() => ({
  media: null as null | { url: string },
  where: null as null | Record<string, unknown>,
  session: null as null | { user: { id: string; role: string } },
}))

vi.mock('@/lib/auth', () => ({
  auth:
    (handler: (req: NextRequest & { auth: unknown }) => Response) =>
    (req: NextRequest) =>
      handler(Object.assign(req, { auth: m.session })),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    mediaReferentiel: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        m.where = where
        return m.media
      },
    },
  },
}))

const UUID = '0f8e4c1a-1b2c-4d3e-8f90-123456789abc'
let racine: string

beforeEach(async () => {
  m.media = null
  m.where = null
  m.session = null
  racine = await mkdtemp(path.join(os.tmpdir(), 'gleba-ui01-'))
  await mkdir(path.join(racine, 'public', 'uploads', 'referentiel', 'membre'), { recursive: true })
  await writeFile(path.join(racine, 'public', 'uploads', 'referentiel', 'membre', `${UUID}-1200.jpg`), Buffer.from([0xff, 0xd8, 0xff]))
  vi.spyOn(process, 'cwd').mockReturnValue(racine)
  return async () => {
    vi.restoreAllMocks()
    await rm(racine, { recursive: true, force: true })
  }
})

const { default: middleware } = await import('@/middleware')
const { GET } = await import('./route')
const { srcImageReferentielPublique } = await import('@/lib/referentiel-medias-public')

const visiter = (url: string) => (middleware as unknown as (req: NextRequest) => Response)(new NextRequest(url))
const lire = (id: string) => GET(new NextRequest(`http://local.test/api/public/referentiel/medias/${id}`), { params: Promise.resolve({ id }) })

describe('UI-01 : photos validées du référentiel pour un visiteur anonyme', () => {
  it('le dossier /uploads reste fermé aux anonymes', () => {
    const res = visiter(`https://gleba.fr/uploads/referentiel/membre/${UUID}-1200.jpg`)
    expect(res.status).toBe(307)
  })

  it('l’adresse utilisée par la fiche publique passe le middleware sans session', () => {
    const res = visiter(`https://gleba.fr${srcImageReferentielPublique('media-1')}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('une photo validée d’un végétal public est servie en JPEG', async () => {
    m.media = { url: `/uploads/referentiel/membre/${UUID}-1200.jpg` }
    const res = await lire('media-1')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(Buffer.from(await res.arrayBuffer())).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
    // Seules les photos VALIDÉES d'un végétal visible publiquement.
    expect(m.where).toMatchObject({ id: 'media-1', statut: 'VALIDE' })
    expect(m.where).toHaveProperty('espece')
  })

  it('une photo non validée, absente ou d’un végétal privé répond 404', async () => {
    m.media = null
    expect((await lire('media-propose')).status).toBe(404)
  })

  it('une URL stockée hors du dossier du référentiel n’est jamais lue', async () => {
    m.media = { url: '/uploads/u1/justificatifs/facture.jpg' }
    expect((await lire('media-1')).status).toBe(404)
    m.media = { url: `/uploads/referentiel/membre/../../../etc/${UUID}-1200.jpg` }
    expect((await lire('media-1')).status).toBe(404)
  })
})
