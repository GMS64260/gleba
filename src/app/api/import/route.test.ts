import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  session: { user: { id: 'importateur', role: 'USER' as string, estProprietaireExploitation: true as boolean } },
  creations: [] as Array<{ modele: string; data: Record<string, unknown> }>,
}))

// Référentiels de l'instance : une entrée privée d'un tiers, une partagée, une officielle, une du compte.
const referentiel = [
  { id: 'prive-tiers', userId: 'tiers', partageCommunaute: false },
  { id: 'partage-tiers', userId: 'tiers', partageCommunaute: true },
  { id: 'officiel', userId: null, partageCommunaute: false },
  { id: 'perso', userId: 'importateur', partageCommunaute: false },
]
type Filtre = { id?: string; AND?: Filtre[]; OR?: Array<Record<string, unknown>> }
const correspond = (ligne: Record<string, unknown>, where: Filtre): boolean =>
  (where.id === undefined || ligne.id === where.id)
  && (where.AND ?? []).every((w) => correspond(ligne, w))
  && (!where.OR || where.OR.some((w) => Object.entries(w).every(([k, v]) => ligne[k] === v)))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: async () => ({ error: null, session: mocks.session }) }))
vi.mock('@/lib/demo-garde', () => ({ MESSAGES_REFUS_DEMO: { importer: 'refus' }, refusSiCompteDemo: async () => null }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const REFERENTIELS = new Set(['espece', 'iTP', 'variete'])
  const client: object = new Proxy({}, {
    get: (_cible, modele: string) => {
      if (modele === '$transaction') return (action: (tx: object) => Promise<unknown>) => action(client)
      const chercher = async ({ where }: { where: Filtre }) =>
        REFERENTIELS.has(modele) ? referentiel.find((l) => correspond(l, where)) ?? null : null
      return {
        findUnique: modele === 'user' ? async () => ({ id: 'importateur' }) : chercher,
        findFirst: chercher,
        findMany: async () => [],
        create: async ({ data }: { data: Record<string, unknown> }) => {
          mocks.creations.push({ modele, data })
          return { id: mocks.creations.length, ...data }
        },
      }
    },
  })
  return { default: client }
})

import { POST } from './route'

const importer = (data: unknown) => {
  const form = new FormData()
  form.set('file', new File([JSON.stringify(data)], 'export.json', { type: 'application/json' }))
  return POST(new NextRequest('http://localhost/api/import', { method: 'POST', body: form }))
}
const ids = referentiel.map((l) => l.id)
const fichier = {
  cultures: ids.map((id, i) => ({ id: i + 1, especeId: id, itpId: 'prive-tiers', varieteId: 'prive-tiers', annee: 2026 }))
    .concat([{ id: 9, especeId: 'officiel', itpId: 'partage-tiers', varieteId: 'perso', annee: 2026 }]),
  arbres: [{ nom: 'Pommier', type: 'fruitier', especeId: 'prive-tiers' }, { nom: 'Poirier', type: 'fruitier', especeId: 'officiel' }],
}
const creees = (modele: string) => mocks.creations.filter((c) => c.modele === modele).map((c) => c.data)

beforeEach(() => {
  mocks.creations.length = 0
  mocks.session.user = { id: 'importateur', role: 'USER', estProprietaireExploitation: true }
})

describe("POST /api/import : références de référentiel et droits (revue de sécurité du 2026-11-11)", () => {
  it("ne rattache aucune culture ni aucun arbre à l'entrée privée d'un autre compte", async () => {
    const reponse = await importer(fichier)
    expect(reponse.status).toBeLessThan(300)
    const cultures = creees('culture')
    expect(cultures.map((c) => c.especeId)).toEqual(['partage-tiers', 'officiel', 'perso', 'officiel'])
    expect(cultures.slice(0, 3).every((c) => c.itpId === null && c.varieteId === null)).toBe(true)
    expect(cultures[3]).toMatchObject({ itpId: 'partage-tiers', varieteId: 'perso' })
    expect(creees('arbre').map((a) => a.especeId)).toEqual([null, 'officiel'])
  })

  it('un administrateur garde toutes les références', async () => {
    mocks.session.user.role = 'ADMIN'
    await importer({ cultures: fichier.cultures })
    expect(creees('culture')[0]).toMatchObject({ especeId: 'prive-tiers', itpId: 'prive-tiers', varieteId: 'prive-tiers' })
  })

  it("refuse l'import à un membre qui n'est pas propriétaire de l'exploitation", async () => {
    mocks.session.user.estProprietaireExploitation = false
    const reponse = await importer(fichier)
    expect(reponse.status).toBe(403)
    expect(mocks.creations).toHaveLength(0)
  })
})
