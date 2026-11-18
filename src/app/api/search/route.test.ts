import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTRE,
  MOI,
  delegueMemoire,
  jeuReferentiel,
  sessionDe,
  type Ligne,
} from '@/lib/__tests__/fixtures/referentiel-memoire'

/**
 * Revue 2026-10-20 — la recherche globale (Cmd+K) listait les variétés sans
 * règle de visibilité : la variété privée d'un autre compte sortait par son nom.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))

import { GET } from './route'

const especeGleba = { id: 'Tomate', userId: null, partageCommunaute: false }
const especePrivee = { id: 'cm-esp-privee', userId: AUTRE, partageCommunaute: false }
const varietes = jeuReferentiel((id, nom) => ({
  id: `v-${id}`,
  nom: `Coeur ${nom}`,
  nomNormalise: `coeur ${nom.toLowerCase()}`,
  especeId: 'Tomate',
  espece: especeGleba,
}))
/** Variété du catalogue posée sur l'espèce privée d'un autre compte. */
const surEspecePrivee = { ...varietes.gleba, id: 'v-sur-espece-privee', nom: 'Coeur caché', espece: especePrivee }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  const vide = { findMany: vi.fn(async () => []) }
  for (const modele of ['culture', 'arbre', 'animal', 'lotAnimaux', 'client', 'facture', 'documentCommercial', 'parcelleGeo', 'soinAnimal', 'recolte', 'produitBoutique']) {
    mocks.db[modele] = vide
  }
  mocks.db.variete = delegueMemoire([...Object.values(varietes), surEspecePrivee] as Ligne[])
})

describe('GET /api/search?q=', () => {
  it('conserve le cloisonnement propriétaire et les modules fermés à un membre', async () => {
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: MOI, role: 'USER', modulesExploitation: ['maraichage'] } },
    })
    mocks.db.culture = delegueMemoire([
      { id: 'culture-moi', userId: MOI, especeId: 'Epinard fictif', annee: 2026 },
      { id: 'culture-autre', userId: AUTRE, especeId: 'Epinard fictif', annee: 2026 },
    ] as Ligne[])
    mocks.db.animal = delegueMemoire([
      { id: 'animal-moi', userId: MOI, nom: 'Epinard fictif', especeAnimale: { nom: 'Ovin' } },
    ] as Ligne[])
    const { items } = await (await GET(new NextRequest('http://localhost/api/search?q=epinard'))).json()
    expect(items.map((item: { id: string }) => item.id)).toEqual(['culture-culture-moi'])
  })

  // FRONT-06 (recette du 2026-11-12) : surface stockée en hectares, affichée en « m² » sans conversion.
  it('affiche la surface d’une parcelle dans la bonne unité', async () => {
    mocks.db.parcelleGeo = delegueMemoire([
      { id: 'p-petite', userId: MOI, nom: 'Ferme debug', surface: 0.25 },
      { id: 'p-grande', userId: MOI, nom: 'Debug grande', surface: 1.5 },
    ] as Ligne[])
    const { items } = await (await GET(new NextRequest('http://localhost/api/search?q=debug'))).json()
    const parSub = Object.fromEntries(items.filter((i: { type: string }) => i.type === 'Parcelle').map((i: { label: string; sub: string }) => [i.label, i.sub]))
    expect(parSub['Ferme debug']).toBe('2500 m\u00B2')
    expect(parSub['Debug grande']).toBe('1.50 ha')
  })

  it('retrouve un devis par son identifiant, sans proposer celui d’une autre exploitation', async () => {
    mocks.db.documentCommercial = delegueMemoire([
      { id: 'devis-moi', userId: MOI, type: 'devis', statut: 'emis', numero: 'D-2026-0001', clientNom: 'Coeur local' },
      { id: 'devis-autre', userId: AUTRE, type: 'devis', statut: 'emis', numero: 'D-2026-0002', clientNom: 'Coeur étranger' },
    ] as Ligne[])
    const { items } = await (await GET(new NextRequest('http://localhost/api/search?q=coeur'))).json()
    expect(items.filter((i: { type: string }) => i.type === 'Devis')).toEqual([
      expect.objectContaining({ id: 'document-devis-moi', href: '/comptabilite/factures?tab=devis&document=devis-moi' }),
    ])
    expect(JSON.stringify(items)).not.toContain('devis-autre')
  })
  it("ne propose que les variétés visibles du compte", async () => {
    const res = await GET(new NextRequest('http://localhost/api/search?q=coeur'))
    expect(res.status).toBe(200)
    const { items } = await res.json()
    const ids = items.filter((i: { id: string }) => i.id.startsWith('variete-')).map((i: { id: string }) => i.id)
    expect(ids).toEqual(['variete-v-gleba-1', 'variete-v-cm-moi', 'variete-v-cm-partagee'])
    expect(JSON.stringify(items)).not.toContain('secrète')
    expect(JSON.stringify(items)).not.toContain('caché')
  })
})


describe('B4/B5 — noms de cultures et récoltes', () => {
  beforeEach(() => {
    const espece = { id: 'cm-esp-42', nom: 'Épinard de printemps', nomNormalise: 'epinard de printemps', userId: MOI, partageCommunaute: false }
    const variete = { id: 'cm-var-42', nom: 'Épinard — Géant', nomNormalise: 'epinard geant', userId: MOI, partageCommunaute: false, especeId: espece.id, espece }
    mocks.db.variete = delegueMemoire([variete])
    mocks.db.culture = delegueMemoire([{ id: 42, userId: MOI, especeId: espece.id, varieteId: variete.id, espece, variete, annee: 2026 }])
    mocks.db.recolte = delegueMemoire([{ id: 43, userId: MOI, especeId: espece.id, espece, quantite: 3, date: new Date('2026-11-01') }])
  })

  async function chercher(q: string) {
    const res = await GET(new NextRequest(`http://localhost/api/search?q=${encodeURIComponent(q)}`))
    expect(res.status).toBe(200)
    return (await res.json()).items as { id: string; label: string }[]
  }

  it.each(['épinard', 'epinard', 'ÉPINARD'])('retrouve les trois catégories par %s malgré des ids techniques', async q => {
    expect((await chercher(q)).map(i => i.id)).toEqual(['culture-42', 'variete-cm-var-42', 'recolte-43'])
  })

  it('retrouve la culture par variété et normalise la ponctuation', async () => {
    for (const q of ['Géant', 'epinard-geant', 'ÉPINARD_GÉANT']) {
      expect((await chercher(q)).map(i => i.id)).toEqual(['culture-42', 'variete-cm-var-42'])
    }
  })

  it('conserve les identifiants historiques et ignore une clé normalisée vide', async () => {
    expect((await chercher('cm-esp-42')).map(i => i.id)).toEqual(['culture-42', 'recolte-43'])
    expect((await chercher('cm-var-42')).map(i => i.id)).toEqual(['culture-42', 'variete-cm-var-42'])
    expect(await chercher('— —')).toEqual([])
    expect(await chercher(' é ')).toEqual([])
  })

  it('conserve le refus sans session', async () => {
    mocks.requireAuthApi.mockResolvedValue({ session: null, error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) })
    expect((await GET(new NextRequest('http://localhost/api/search?q=epinard'))).status).toBe(401)
  })
})
