import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ deleteMany: vi.fn(), count: vi.fn(), create: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    tentativeImportReleve: { deleteMany: mocks.deleteMany, count: mocks.count, create: mocks.create },
  },
}))
import {
  CONTENUS_PAR_JOUR,
  enregistrerTentativeImport,
  purgerTentativesImport,
  rejouerTentativeImport,
} from './tentatives'

const releve = 'Date;Libellé;Débit;Crédit\n02/10/2026;Coop fictive;45,60;\n05/10/2026;Marché fictif;;320,00\n'
const octets = Buffer.from(releve, 'latin1')
const base = { userId: 'u1', compteId: 'c1', nomFichier: 'releve.csv', octets, source: 'fichier' as const }
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('tentatives d’import de relevé', () => {
  it('purge ce qui a plus de 30 jours', async () => {
    mocks.deleteMany.mockResolvedValue({ count: 2 })
    expect(await purgerTentativesImport(new Date('2026-11-01T12:00:00Z'))).toBe(2)
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date('2026-10-02T12:00:00Z') } },
    })
  })
  it('garde les octets d’origine, leur empreinte et le résultat', async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 })
    mocks.count.mockResolvedValue(0)
    await enregistrerTentativeImport({ ...base, statut: 'refuse', message: 'x'.repeat(2000) })
    const { data } = mocks.create.mock.calls[0][0]
    expect(Buffer.from(data.contenu).equals(octets)).toBe(true)
    expect(data).toMatchObject({
      userId: 'u1',
      compteId: 'c1',
      nomFichier: 'releve.csv',
      tailleOctets: octets.byteLength,
      empreinte: createHash('sha256').update(octets).digest('hex'),
      source: 'fichier',
      statut: 'refuse',
    })
    expect(data.message).toHaveLength(1000)
    expect(mocks.deleteMany).toHaveBeenCalled()
  })
  it('trace sans contenu au-delà du plafond quotidien', async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 })
    mocks.count.mockResolvedValue(CONTENUS_PAR_JOUR)
    await enregistrerTentativeImport({ ...base, statut: 'importe', importees: 2, dejaPresentes: 0 })
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ contenu: null, statut: 'importe', importees: 2 })
  })
  it('n’empêche jamais l’import et ne journalise ni contenu ni identité', async () => {
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.deleteMany.mockRejectedValue(new Error('base indisponible'))
    await expect(enregistrerTentativeImport({ ...base, statut: 'importe' })).resolves.toBeUndefined()
    const journal = avertissement.mock.calls.flat().map(String).join(' ')
    expect(journal).not.toContain('Coop')
    expect(journal).not.toContain('u1')
  })
  it('rejoue un fichier Windows-1252 conservé avec le lecteur en service', () =>
    expect(rejouerTentativeImport(octets, 'fichier')).toEqual({
      lisible: true,
      operations: 2,
      du: '2026-10-02',
      au: '2026-10-05',
      netCentimes: 27440,
    }))
  it('rejoue un texte envoyé par un ancien client et rend le motif d’un refus', () => {
    expect(rejouerTentativeImport(Buffer.from(releve, 'utf8'), 'texte')).toMatchObject({ lisible: true, operations: 2 })
    expect(rejouerTentativeImport(Buffer.from('Date;Opération\n02/10/2026;A', 'utf8'), 'texte')).toMatchObject({
      lisible: false,
      message: expect.stringContaining('Colonnes requises'),
    })
  })
})
