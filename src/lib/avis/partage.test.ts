import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ recolte: vi.fn(), espece: vi.fn(), variete: vi.fn(), itp: vi.fn(), avis: vi.fn(), upsert: vi.fn(),
  partage: vi.fn(), partages: vi.fn(), create: vi.fn(), final: vi.fn(), photoCreate: vi.fn(), photoFind: vi.fn(), photoDelete: vi.fn(), photoUpdate: vi.fn(), raw: vi.fn(), tx: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: {
  recolte: { findFirst: m.recolte }, espece: { findFirst: m.espece }, variete: { findFirst: m.variete }, iTP: { findFirst: m.itp },
  avis: { findUnique: m.avis, upsert: m.upsert }, temoignageRecolte: { findMany: m.partages, findUnique: m.partage, create: m.create, findUniqueOrThrow: m.final },
  photoAvis: { create: m.photoCreate, findMany: m.photoFind, deleteMany: m.photoDelete, update: m.photoUpdate }, $queryRaw: m.raw, $transaction: m.tx,
} }))
import prisma from '@/lib/prisma'
import { apercuPartageRecolte, partagerRecolte, remplacerPhotosAvis } from './service'
const date = new Date('2026-10-26T12:00:00Z')
const recolte = { id: 7, userId: 'ferme', date, quantite: 12, unite: 'piece', especeId: 'courge', culture: { varieteId: 'variete', itpId: 'itp' }, prixTotal: 500, clientNom: 'À ne pas partager', notes: 'Note privée', cultureId: 99 }
const temoin = { id: 'temoin', dateRecolte: date, quantite: 12, unite: 'piece', commentaire: null, photos: [], createdAt: date }
beforeEach(() => {
  vi.resetAllMocks(); m.recolte.mockResolvedValue(recolte); m.espece.mockResolvedValue({ id: 'courge', nom: 'Courge' })
  m.variete.mockResolvedValue({ id: 'variete', nom: 'Variété' }); m.itp.mockResolvedValue({ id: 'itp', nom: 'Itinéraire', userId: null })
  m.partages.mockResolvedValue([]); m.avis.mockResolvedValue(null); m.upsert.mockResolvedValue({ id: 'avis' }); m.partage.mockResolvedValue(null)
  m.raw.mockResolvedValue([{ id: 'present' }]); m.create.mockResolvedValue({ id: 'temoin' }); m.final.mockResolvedValue(temoin)
  m.photoFind.mockResolvedValue([]); m.tx.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma))
})
async function body() { const preview = await apercuPartageRecolte(7, 'ferme', 'ferme'); return { refType: 'ESPECE' as const, refId: 'courge', partagerQuantite: true, empreinteBase: preview.empreinte } }
describe('publication volontaire d’une récolte', () => {
  it('ne renvoie que l’aperçu sûr et des références déduites du serveur', async () => {
    const preview = await apercuPartageRecolte(7, 'ferme', 'ferme')
    expect(preview).toMatchObject({ quantite: 12, unite: 'piece', cibles: expect.any(Array), empreinte: expect.stringMatching(/^[a-f0-9]{64}$/) })
    expect(JSON.stringify(preview)).not.toMatch(/prix|client|notes|cultureId|userId/)
    expect(m.variete.mock.calls[0][0].where).toMatchObject({ especeId: 'courge' }); expect(m.itp.mock.calls[0][0].where).toMatchObject({ especeId: 'courge', actif: true })
  })
  it('refuse un membre qui consulte une autre exploitation avant de lire sa récolte', async () => {
    await expect(apercuPartageRecolte(7, 'membre', 'ferme')).rejects.toMatchObject({ status: 403 })
    expect(m.recolte).not.toHaveBeenCalled()
  })
  it('préserve l’avis existant et la paire quantité/unité du snapshot', async () => {
    const result = await partagerRecolte(7, 'ferme', 'ferme', await body())
    expect(result.cree).toBe(true); expect(m.upsert.mock.calls[0][0].update).toEqual({})
    expect(m.create.mock.calls[0][0].data).toMatchObject({ recolteId: 7, quantite: 12, unite: 'piece', dateRecolte: date })
    expect(JSON.stringify(result)).not.toMatch(/prix|client|cultureId|userId|recolteId/)
  })
  it('ne copie aucune quantité ni unité si l’utilisateur ne les partage pas', async () => {
    await partagerRecolte(7, 'ferme', 'ferme', { ...await body(), partagerQuantite: false })
    expect(m.create.mock.calls[0][0].data).toMatchObject({ quantite: null, unite: null })
  })
  it('refuse une récolte modifiée depuis l’aperçu sans créer de parent avis', async () => {
    const data = await body(); m.recolte.mockResolvedValue({ ...recolte, quantite: 20 })
    await expect(partagerRecolte(7, 'ferme', 'ferme', data)).rejects.toMatchObject({ status: 409 })
    expect(m.upsert).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled()
  })
  it('retourne le partage existant sans modifier ses photos ou son snapshot', async () => {
    const data = await body(); m.avis.mockResolvedValue({ id: 'avis' }); m.partage.mockResolvedValue(temoin); m.recolte.mockResolvedValue({ ...recolte, quantite: 20 })
    const result = await partagerRecolte(7, 'ferme', 'ferme', data)
    expect(result.cree).toBe(false); expect(result.temoignage.quantite).toBe(12)
    expect(m.create).not.toHaveBeenCalled(); expect(m.photoCreate).not.toHaveBeenCalled(); expect(m.upsert).not.toHaveBeenCalled()
  })
  it('refuse une cible fournie par le client qui ne vient pas de la culture', async () => {
    await expect(partagerRecolte(7, 'ferme', 'ferme', { ...await body(), refId: 'autre-espece' })).rejects.toMatchObject({ status: 404 })
    expect(m.create).not.toHaveBeenCalled()
  })
  it.each([{ quantite: -2 }, { quantite: Number.NaN }, { unite: 'litres' }])('refuse un ancien enregistrement non partageable %j', async changement => {
    m.recolte.mockResolvedValue({ ...recolte, ...changement })
    await expect(apercuPartageRecolte(7, 'ferme', 'ferme')).rejects.toMatchObject({ status: 400 })
  })
})
describe('photos directes de l’avis', () => {
  it('ne touche pas aux photos si le champ est absent', async () => {
    await remplacerPhotosAvis(prisma, 'avis', undefined)
    expect(m.photoFind).not.toHaveBeenCalled(); expect(m.photoDelete).not.toHaveBeenCalled()
  })
  it('refuse un identifiant appartenant à une autre publication avant tout retrait', async () => {
    m.photoFind.mockResolvedValue([{ id: 'autre', position: 0 }])
    await expect(remplacerPhotosAvis(prisma, 'avis', [{ id: 'vole', legende: null }])).rejects.toMatchObject({ status: 400 })
    expect(m.photoDelete).not.toHaveBeenCalled()
  })
  it('ne retire que les photos directes, jamais celles d’un témoignage', async () => {
    await remplacerPhotosAvis(prisma, 'avis', [])
    expect(m.photoDelete.mock.calls[0][0].where).toEqual({ avisId: 'avis', id: { notIn: [] } })
  })
})
