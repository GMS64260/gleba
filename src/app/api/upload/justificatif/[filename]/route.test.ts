import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), readFile: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.auth }))
vi.mock('node:fs/promises', () => ({ readFile: mocks.readFile }))
import { GET } from './route'

const uuid = '123e4567-e89b-42d3-a456-426614174000'
const lire = (filename: string) => GET(new NextRequest('http://local.test/api/upload/justificatif'), {
  params: Promise.resolve({ filename }),
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ error: null, session: { user: { id: 'tenant-fictif' }, acteurId: 'membre-fictif' } })
  mocks.readFile.mockResolvedValue(Buffer.from('Pièce fictive'))
})

describe('Lecture du justificatif — format partagé et dossier du tenant résolu', () => {
  it.each([
    ['pdf', 'application/pdf'], ['jpg', 'image/jpeg'], ['png', 'image/png'], ['PDF', 'application/pdf'],
  ])('lit %s avec les en-têtes existants', async (extension, mime) => {
    const filename = `${uuid}.${extension}`
    const res = await lire(filename)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('Pièce fictive')
    expect(mocks.readFile).toHaveBeenCalledWith(path.join(process.cwd(), 'storage', 'justificatifs', 'tenant-fictif', filename))
    expect(res.headers.get('content-type')).toBe(mime)
    expect(res.headers.get('content-disposition')).toBe(`inline; filename="${filename}"`)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it.each([
    '../secret.pdf', `%2e%2e%2f${uuid}.pdf`, `%252e%252e%252f${uuid}.pdf`, `../${uuid}.pdf`, `..\\${uuid}.pdf`,
    `${uuid}.svg`, `${uuid}.pdf\n`, `${uuid}.pdf?x=1`, `${uuid}.pdf/extra`, uuid.replace('-42d3-', '-12d3-') + '.pdf',
    `/api/upload/justificatif/${uuid}.pdf`,
  ])('refuse le nom %s avant accès disque', async filename => {
    expect((await lire(filename)).status).toBe(400)
    expect(mocks.readFile).not.toHaveBeenCalled()
  })

  it('renvoie le refus d’authentification sans lire le disque', async () => {
    mocks.auth.mockResolvedValue({ session: null, error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) })
    expect((await lire(`${uuid}.pdf`)).status).toBe(401)
    expect(mocks.readFile).not.toHaveBeenCalled()
  })

  it('un fichier absent du dossier du tenant reste introuvable', async () => {
    mocks.readFile.mockRejectedValue(new Error('ENOENT'))
    const res = await lire(`${uuid}.pdf`)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Justificatif introuvable' })
  })
})
