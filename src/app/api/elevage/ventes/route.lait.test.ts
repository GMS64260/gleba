/**
 * Bilan matière du lait (2026-11-03) : une vente de lait cru au-delà de la
 * traite des 7 derniers jours rend un 422 confirmable. Le calcul est testé
 * dans src/lib/elevage/bilan-lait.test.ts ; ici, son branchement.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  auth: vi.fn(), verifier: vi.fn(), venteAvant: vi.fn(), venteTx: vi.fn(),
  venteCreate: vi.fn(), venteUpdate: vi.fn(), soins: vi.fn(), pointage: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: m.auth }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({ createVenteFromVenteProduit: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/facture-utils', () => ({ creerFacture: vi.fn(), annulerFactureLiee: vi.fn() }))
vi.mock('@/lib/comptabilite/verrou-reglements', () => ({ verrouillerReglements: vi.fn() }))
vi.mock('@/lib/comptabilite/projection-reglements', () => ({ enrichirVentesElevageReglements: vi.fn() }))
vi.mock('@/lib/comptabilite/suivi-ecriture', () => ({ chargerSuiviDesSources: vi.fn(), cleSource: vi.fn() }))
vi.mock('@/lib/comptabilite/suivi-reglement-source', () => ({ verifierPointageDetaille: m.pointage }))
vi.mock('@/lib/elevage/bilan-lait', async (original) => ({
  ...(await original<typeof import('@/lib/elevage/bilan-lait')>()),
  verifierDisponibiliteLait: m.verifier,
}))
vi.mock('@/lib/prisma', () => {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    venteProduit: { findFirst: m.venteTx, create: m.venteCreate, update: m.venteUpdate },
  }
  return { default: {
    venteProduit: { findFirst: m.venteAvant },
    soinAnimal: { findMany: m.soins },
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  } }
})

import { PATCH, POST } from './route'

const alerte = {
  debut: '2026-10-28', fin: '2026-11-03', collecte: 20, ecarte: 0, livre: 0, venduCru: 30, transforme: 0,
  disponible: 20, sorties: 30, nonAffecte: -10, nbCollectes: 2, ventesHorsLitres: 0, depassement: 10, tolerance: 1,
}
const appel = (method: 'POST' | 'PATCH', body: object) => (method === 'POST' ? POST : PATCH)(
  new NextRequest('http://localhost/api/elevage/ventes', {
    method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }),
)
const venteLait = { date: '2026-11-03', type: 'lait', quantite: 30, unite: 'L', prixUnitaire: 1.2, paye: true, modeReglement: 'Espèces' }
const existante = {
  id: 12, userId: 'u1', date: new Date('2026-11-02T00:00:00Z'), type: 'lait', quantite: 10, unite: 'L',
  prixUnitaire: 1.2, prixTotal: 12, paye: true, annule: false, factureId: null, lotFromageId: null,
  animalId: null, client: null, notes: null, description: null, destinationId: null, tauxTVA: 5.5,
}

beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
  m.verifier.mockResolvedValue(null)
  m.soins.mockResolvedValue([])
  m.pointage.mockResolvedValue({})
  m.venteCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: 99, ...data }))
  m.venteAvant.mockResolvedValue(structuredClone(existante))
  m.venteTx.mockResolvedValue(structuredClone(existante))
  m.venteUpdate.mockImplementation(async ({ data }: { data: object }) => ({ ...existante, ...data }))
})

describe('POST /api/elevage/ventes — lait cru et bilan sur 7 jours', () => {
  it('rend un 422 confirmable sans rien écrire quand la vente dépasse la traite', async () => {
    m.verifier.mockResolvedValue(alerte)

    const res = await appel('POST', venteLait)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.code).toBe('LAIT_INDISPONIBLE')
    expect(json.error).toContain('10 L de plus que la traite')
    expect(m.verifier).toHaveBeenCalledWith(expect.anything(), 'u1', { ajout: [{ jour: '2026-11-03', poste: 'venduCru', litres: 30 }] })
    expect(m.venteCreate).not.toHaveBeenCalled()
  })

  it('enregistre la vente confirmée sans recontrôler', async () => {
    const res = await appel('POST', { ...venteLait, confirmerLaitIndisponible: true })

    expect(res.status).toBe(201)
    expect(m.verifier).not.toHaveBeenCalled()
    expect(m.venteCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.not.objectContaining({ confirmerLaitIndisponible: true }) }))
  })

  it('ne contrôle pas une vente de lait sans volume en litres', async () => {
    expect((await appel('POST', { ...venteLait, unite: 'unite' })).status).toBe(201)
    expect(m.verifier).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/elevage/ventes — correction d’une vente de lait cru', () => {
  it('recontrôle une hausse de volume en retirant l’ancienne vente', async () => {
    m.verifier.mockResolvedValue(alerte)

    const res = await appel('PATCH', { id: 12, quantite: 30 })

    expect(res.status).toBe(422)
    expect(m.verifier).toHaveBeenCalledWith(expect.anything(), 'u1', {
      ajout: [{ jour: '2026-11-02', poste: 'venduCru', litres: 30, source: 'vente:12' }],
      retirerSource: 'vente:12',
      jours: ['2026-11-02'],
    })
    expect(m.venteUpdate).not.toHaveBeenCalled()
  })

  it('suit la vente déplacée à un autre jour', async () => {
    await appel('PATCH', { id: 12, date: '2026-11-03' })
    expect(m.verifier).toHaveBeenCalledWith(expect.anything(), 'u1', expect.objectContaining({
      ajout: [expect.objectContaining({ jour: '2026-11-03', litres: 10 })],
      jours: ['2026-11-02'],
    }))
  })

  it('ne contrôle ni une correction du prix ni une correction confirmée', async () => {
    await appel('PATCH', { id: 12, prixUnitaire: 1.5 })
    await appel('PATCH', { id: 12, quantite: 30, confirmerLaitIndisponible: true })
    expect(m.verifier).not.toHaveBeenCalled()
  })
})
