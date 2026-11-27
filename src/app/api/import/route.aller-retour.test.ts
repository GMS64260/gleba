/**
 * Aller-retour export partiel → import (équipe debug, D171).
 *
 * L'export écrit chaque planche avec son identifiant et ses lignes enfants avec
 * ce même identifiant. Réimporté dans un compte où la planche n'existe plus,
 * le fichier doit rattacher cultures et fertilisations à la planche recréée.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>
const base = vi.hoisted(() => ({
  planches: [] as Array<Record<string, unknown>>,
  creations: [] as Array<{ modele: string; data: Record<string, unknown> }>,
  role: 'USER' as string,
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({
    error: null,
    session: { user: { id: 'moi', role: base.role, estProprietaireExploitation: true } },
  }),
}))
vi.mock('@/lib/exploitation/garde-session', () => ({ refusSiPasProprietaire: () => null }))
vi.mock('@/lib/demo-garde', () => ({ MESSAGES_REFUS_DEMO: { importer: 'refus' }, refusSiCompteDemo: async () => null }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromFertilisation: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const client: object = new Proxy({}, {
    get: (_cible, modele: string) => {
      if (modele === '$transaction') return (action: (tx: object) => Promise<unknown>) => action(client)
      const trouverPlanche = (where: { id?: string; userId?: string; nom_userId?: { nom: string; userId: string } }) =>
        base.planches.find((p) => where.nom_userId
          ? p.nom === where.nom_userId.nom && p.userId === where.nom_userId.userId
          : p.id === where.id && p.userId === where.userId) ?? null
      const chercher = async ({ where }: { where: Ligne }) => {
        if (modele === 'user') return { id: 'moi' }
        if (modele === 'planche') return trouverPlanche(where)
        if (modele === 'espece') return { id: 'laitue' }
        if (modele === 'fertilisant') return { id: where.id }
        return null
      }
      return {
        findUnique: chercher,
        findFirst: chercher,
        findMany: async () => [],
        update: async ({ data }: { data: Ligne }) => data,
        create: async ({ data }: { data: Ligne }) => {
          const ligne = { id: `nouveau-${base.creations.length + 1}`, ...data }
          if (modele === 'planche') base.planches.push(ligne)
          base.creations.push({ modele, data })
          return ligne
        },
      }
    },
  })
  return { default: client }
})

import { POST } from './route'

const importer = async (data: unknown) => {
  const form = new FormData()
  form.set('file', new File([JSON.stringify(data)], 'export.json', { type: 'application/json' }))
  const reponse = await POST(new NextRequest('http://localhost/api/import', { method: 'POST', body: form }))
  return { statut: reponse.status, corps: await reponse.json() }
}
const creees = (modele: string) => base.creations.filter((c) => c.modele === modele).map((c) => c.data)

const fichierExporte = {
  // Référentiels embarqués par l'export : non relus pour un compte ordinaire.
  especes: [{ id: 'laitue' }, { id: 'radis' }, { id: 'carotte' }],
  planches: [{ id: 'ancien-cuid', nom: 'Planche fictive apport 9', largeur: 1, longueur: 5, annee: 2026 }],
  cultures: [{ id: 7, especeId: 'laitue', plancheId: 'ancien-cuid', annee: 2026 }],
  fertilisations: [{ id: 3, plancheId: 'ancien-cuid', fertilisantId: 'fumier', date: '2026-11-26', quantite: 2.5 }],
}

beforeEach(() => {
  base.planches.length = 0
  base.creations.length = 0
  base.role = 'USER'
})

describe('POST /api/import, aller-retour de l’export partiel', () => {
  it('rattache culture et fertilisation à la planche recréée, désignée par son ancien identifiant', async () => {
    const { statut, corps } = await importer(fichierExporte)

    expect(statut).toBe(200)
    const planche = base.planches[0]
    expect(planche.nom).toBe('Planche fictive apport 9')
    expect(creees('fertilisation')).toEqual([expect.objectContaining({ plancheId: planche.id, quantite: 2.5 })])
    expect(creees('culture')).toEqual([expect.objectContaining({ plancheId: planche.id })])
    expect(corps.stats).toMatchObject({ planches: 1, cultures: 1, fertilisations: 1 })
  })

  it('ne compte pas les référentiels du fichier comme des lignes ignorées pour un compte ordinaire', async () => {
    const { corps } = await importer(fichierExporte)

    expect(corps.ignores).toBe(0)
    expect(corps.message).toBe('3 enregistrements importés')
  })

  it('relit toujours l’ancien format, où la planche est désignée par son nom', async () => {
    await importer({
      planches: [{ id: 'Planche A' }],
      fertilisations: [{ id: 1, plancheId: 'Planche A', fertilisantId: 'fumier', date: '2026-11-26', quantite: 1 }],
    })

    expect(creees('fertilisation')).toEqual([expect.objectContaining({ plancheId: base.planches[0].id })])
  })

  it('ne rattache rien à un identifiant de planche inconnu du fichier et du compte', async () => {
    base.planches.push({ id: 'planche-d-un-tiers', nom: 'Chez le voisin', userId: 'tiers' })

    const { corps } = await importer({
      cultures: [{ id: 1, especeId: 'laitue', plancheId: 'planche-d-un-tiers', annee: 2026 }],
      fertilisations: [{ id: 1, plancheId: 'planche-d-un-tiers', fertilisantId: 'fumier', date: '2026-11-26', quantite: 1 }],
    })

    expect(creees('fertilisation')).toEqual([])
    expect(creees('culture')).toEqual([expect.objectContaining({ plancheId: null })])
    expect(corps.ignores).toBe(1)
  })
})
