import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const m = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn(), count: vi.fn(), creer: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: m.auth }))
vi.mock('@/lib/prisma', () => ({ default: { documentCommercial: { findMany: m.findMany, count: m.count } } }))
vi.mock('@/lib/commercial/service', () => ({ creerDocument: m.creer, relationsDocument: { lignes: true } }))
import { GET, POST } from './route'

describe('Documents commerciaux : portée des API', () => {
  beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ session: { user: { id: 'ferme-proprietaire', acteurId: 'membre' } }, error: null }); m.findMany.mockResolvedValue([]); m.count.mockResolvedValue(0) })
  it('utilise le propriétaire pour une exploitation partagée et ignore un userId fourni', async () => {
    const r = await GET(new NextRequest('http://localhost/api/comptabilite/documents?type=devis&annee=all&userId=autre'))
    expect(r.status).toBe(200)
    expect(m.findMany.mock.calls[0][0].where).toMatchObject({ userId: 'ferme-proprietaire', type: 'devis' })
  })
  it('retrouve un document par identifiant même hors exercice et scope les deux lectures', async () => {
    await GET(new NextRequest('http://localhost/api/comptabilite/documents?id=doc-ancien&type=devis'))
    expect(m.findMany.mock.calls[0][0].where).toEqual({ userId: 'ferme-proprietaire', type: 'devis', id: 'doc-ancien' })
    expect(m.count.mock.calls[0][0].where).toEqual(m.findMany.mock.calls[0][0].where)
  })
  it('respecte le refus des comptes en lecture seule avant tout accès métier', async () => {
    m.auth.mockResolvedValue({ error: NextResponse.json({ error: 'LECTURE_SEULE' }, { status: 403 }), session: null })
    expect((await POST(new NextRequest('http://localhost/api/comptabilite/documents', { method: 'POST', body: '{}' }))).status).toBe(403)
    expect(m.creer).not.toHaveBeenCalled()
  })
  it('refuse les données invalides sans créer de document', async () => {
    const r = await POST(new NextRequest('http://localhost/api/comptabilite/documents', { method: 'POST', body: JSON.stringify({ cle: 'invalide', contenu: {} }) }))
    expect(r.status).toBe(400); expect(m.creer).not.toHaveBeenCalled()
  })
})
