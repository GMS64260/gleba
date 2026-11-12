/**
 * COM-02 et COM-03 (revue Codex du 2026-11-12) : HT et TVA des ventes et
 * dépenses manuelles.
 *
 * COM-02 : `montantHT` et `montantTVA` étaient acceptés tels quels. Vente de
 * 120 € TTC à 20 % avec HT 100 et TVA 999 : FEC débit 120, crédits 1 099.
 * Le TTC et le taux font foi ; une ventilation fournie n'est retenue que si
 * elle est cohérente au centime.
 *
 * COM-03 : le PATCH recalculait HT/TVA AVANT le verrou, depuis la lecture
 * d'avant. Deux corrections concurrentes (TTC 100 → 200, taux 20 → 10)
 * laissaient TTC 200 avec HT 90,91 et TVA 9,09. Le recalcul part de
 * l'écriture relue sous le verrou.
 *
 * Écritures de la caisse ou de la boutique (consigne de la session caisse) :
 * leurs montants ne se recalculent jamais ici, refus 409.
 *
 * Routes réelles ; fausse base en mémoire dont le verrou consultatif
 * sérialise les transactions comme `pg_advisory_xact_lock`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown> & { id: number; userId: string }

const etat = vi.hoisted(() => ({
  ventes: new Map<number, Record<string, unknown> & { id: number; userId: string }>(),
  depenses: new Map<number, Record<string, unknown> & { id: number; userId: string }>(),
  verrou: Promise.resolve() as Promise<void>,
  aLaPriseDuVerrou: null as null | (() => void),
  seq: 100,
}))

function table(t: Map<number, Ligne>) {
  return {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      for (const l of t.values()) {
        if (Object.entries(where).every(([k, v]) => l[k] === v)) return { ...l }
      }
      return null
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const l = { ...data, id: ++etat.seq } as Ligne
      t.set(l.id, l)
      return { ...l }
    },
    update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
      const l = t.get(where.id)!
      for (const [k, v] of Object.entries(data)) if (v !== undefined) l[k] = v
      return { ...l }
    },
  }
}

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'u1' } } }),
}))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/comptabilite/suivi-reglement-source', () => ({
  verifierPointageDetaille: async () => ({}),
  suiviReglementActif: async () => null,
}))
vi.mock('@/lib/comptabilite/ensure-client', () => ({
  ClientIntrouvableError: class extends Error {},
  ensureClientForUser: async () => null,
  exigerClientDuCompte: async () => undefined,
}))
vi.mock('@/lib/comptabilite/ensure-fournisseur', () => ({ ensureFournisseurForUser: async () => null }))
vi.mock('@/lib/prisma', () => {
  const db = {
    venteManuelle: table(etat.ventes),
    depenseManuelle: table(etat.depenses),
    venteProduit: { updateMany: async () => ({ count: 1 }) },
    $queryRaw: async () => [{ id: 1 }],
  }
  return {
    default: {
      ...db,
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        let liberer: (() => void) | undefined
        const tx = {
          ...db,
          $executeRaw: async () => {
            if (liberer) return 0
            const precedent = etat.verrou
            etat.verrou = new Promise<void>((r) => { liberer = r })
            await precedent
            const crochet = etat.aLaPriseDuVerrou
            etat.aLaPriseDuVerrou = null
            crochet?.()
            return 0
          },
        }
        try {
          return await fn(tx)
        } finally {
          liberer?.()
        }
      },
    },
  }
})

import { createVenteManuelleSchema } from '@/lib/validations/vente-manuelle'
import { createDepenseManuelleSchema } from '@/lib/validations/depense-manuelle'
import { PATCH as patchVente, POST as postVente } from './route'
import { PATCH as patchDepense, POST as postDepense } from '../depenses-manuelles/route'

const req = (url: string, method: 'POST' | 'PATCH', corps: object) =>
  new NextRequest(`http://local.test${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  })
const VENTES = '/api/comptabilite/ventes-manuelles'
const DEPENSES = '/api/comptabilite/depenses-manuelles'

const ligne = (extra: Record<string, unknown> = {}): Ligne => ({
  id: 1, userId: 'u1', auto: false, sourceType: null, sourceId: null,
  montant: 100, tauxTVA: 20, montantHT: 83.33, montantTVA: 16.67, paye: true, journal: 'VE',
  ...extra,
})

function centimes(l: Record<string, unknown>) {
  return {
    ttc: Math.round((l.montant as number) * 100),
    ht: Math.round((l.montantHT as number) * 100),
    tva: Math.round((l.montantTVA as number) * 100),
  }
}

beforeEach(() => {
  etat.ventes.clear()
  etat.depenses.clear()
  etat.verrou = Promise.resolve()
  etat.aLaPriseDuVerrou = null
  etat.seq = 100
})

describe('COM-02 : la ventilation HT/TVA ne se fie pas au client', () => {
  it('le schéma de création refuse HT 100 + TVA 999 pour 120 € TTC à 20 %', () => {
    const corps = { categorie: 'Légumes', description: 'Panier', montant: 120, tauxTVA: 20, montantHT: 100, montantTVA: 999 }
    expect(createVenteManuelleSchema.safeParse(corps).success).toBe(false)
    expect(createDepenseManuelleSchema.safeParse(corps).success).toBe(false)
  })

  it('le schéma accepte une ventilation cohérente et l’absence de ventilation', () => {
    const base = { categorie: 'Légumes', description: 'Panier', montant: 120, tauxTVA: 20 }
    expect(createVenteManuelleSchema.safeParse(base).success).toBe(true)
    expect(createVenteManuelleSchema.safeParse({ ...base, montantHT: 100, montantTVA: 20 }).success).toBe(true)
  })

  it('POST vente : une ventilation incohérente est refusée et rien n’est écrit', async () => {
    const res = await postVente(req(VENTES, 'POST', {
      categorie: 'Légumes', description: 'Panier', montant: 120, tauxTVA: 20, montantHT: 100, montantTVA: 999,
    }))
    expect(res.status).toBe(400)
    expect(etat.ventes.size).toBe(0)
  })

  it('POST vente sans ventilation : HT + TVA = TTC au centime', async () => {
    const res = await postVente(req(VENTES, 'POST', {
      categorie: 'Légumes', description: 'Panier', montant: 24.99, tauxTVA: 20,
    }))
    expect(res.status).toBe(201)
    const l = [...etat.ventes.values()][0]
    expect(l).toMatchObject({ montantHT: 20.83, montantTVA: 4.16 })
    const c = centimes(l)
    expect(c.ht + c.tva).toBe(c.ttc)
  })

  it('POST dépense sans ventilation : HT + TVA = TTC au centime', async () => {
    const res = await postDepense(req(DEPENSES, 'POST', {
      categorie: 'Semences', description: 'Graines', montant: 24.99, tauxTVA: 20,
    }))
    expect(res.status).toBe(201)
    const l = [...etat.depenses.values()][0]
    expect(l).toMatchObject({ montantHT: 20.83, montantTVA: 4.16 })
  })

  it('PATCH vente {montantTVA: 999} seul est refusé et l’écriture reste intacte', async () => {
    etat.ventes.set(1, ligne({ montant: 120, montantHT: 100, montantTVA: 20 }))
    const res = await patchVente(req(VENTES, 'PATCH', { id: 1, montantTVA: 999 }))
    expect(res.status).toBe(400)
    expect(etat.ventes.get(1)).toMatchObject({ montant: 120, montantHT: 100, montantTVA: 20 })
  })

  it('PATCH dépense {montantTVA: 999} seul est refusé et l’écriture reste intacte', async () => {
    etat.depenses.set(1, ligne({ montant: 120, montantHT: 100, montantTVA: 20, journal: 'AC' }))
    const res = await patchDepense(req(DEPENSES, 'PATCH', { id: 1, montantTVA: 999 }))
    expect(res.status).toBe(400)
    expect(etat.depenses.get(1)).toMatchObject({ montant: 120, montantHT: 100, montantTVA: 20 })
  })
})

describe('COM-03 : le recalcul part de l’écriture relue sous le verrou', () => {
  it('ventes : TTC 100 → 200 et taux 20 → 10 concurrents donnent la ventilation de 200 € à 10 %', async () => {
    etat.ventes.set(1, ligne())
    const [a, b] = await Promise.all([
      patchVente(req(VENTES, 'PATCH', { id: 1, montant: 200 })),
      patchVente(req(VENTES, 'PATCH', { id: 1, tauxTVA: 10 })),
    ])
    expect([a.status, b.status]).toEqual([200, 200])
    expect(etat.ventes.get(1)).toMatchObject({ montant: 200, tauxTVA: 10, montantHT: 181.82, montantTVA: 18.18 })
  })

  it('dépenses : TTC 100 → 200 et taux 20 → 10 concurrents donnent la ventilation de 200 € à 10 %', async () => {
    etat.depenses.set(1, ligne({ journal: 'AC' }))
    const [a, b] = await Promise.all([
      patchDepense(req(DEPENSES, 'PATCH', { id: 1, montant: 200 })),
      patchDepense(req(DEPENSES, 'PATCH', { id: 1, tauxTVA: 10 })),
    ])
    expect([a.status, b.status]).toEqual([200, 200])
    expect(etat.depenses.get(1)).toMatchObject({ montant: 200, tauxTVA: 10, montantHT: 181.82, montantTVA: 18.18 })
  })
})

describe('Écritures à contexte fiscal figé (caisse, boutique)', () => {
  it('une vente de caisse ne voit jamais ses montants recalculés : 409', async () => {
    etat.ventes.set(1, ligne({ sourceType: 'caisse' }))
    const res = await patchVente(req(VENTES, 'PATCH', { id: 1, montant: 50 }))
    expect(res.status).toBe(409)
    expect(etat.ventes.get(1)).toMatchObject({ montant: 100, montantHT: 83.33, montantTVA: 16.67 })
  })

  it('une vente portant un contexte fiscal (zone privée) : 409, même sans source', async () => {
    etat.ventes.set(1, ligne({ contexteFiscal: { regime: 'reel' } }))
    const res = await patchVente(req(VENTES, 'PATCH', { id: 1, tauxTVA: 5.5 }))
    expect(res.status).toBe(409)
    expect(etat.ventes.get(1)).toMatchObject({ tauxTVA: 20, montantHT: 83.33 })
  })

  it('une vente devenue « caisse » entre la lecture et le verrou : 409', async () => {
    etat.ventes.set(1, ligne())
    // La route a lu l'écriture avant le verrou ; elle est figée à la prise du verrou.
    etat.aLaPriseDuVerrou = () => { etat.ventes.get(1)!.contexteFiscal = { regime: 'reel' } }
    const res = await patchVente(req(VENTES, 'PATCH', { id: 1, montant: 50 }))
    expect(res.status).toBe(409)
    expect(etat.ventes.get(1)!.montant).toBe(100)
  })

  it('le suivi du règlement reste modifiable sur une vente de caisse', async () => {
    etat.ventes.set(1, ligne({ sourceType: 'caisse' }))
    const res = await patchVente(req(VENTES, 'PATCH', { id: 1, notes: 'Pointé' }))
    expect(res.status).toBe(200)
    expect(etat.ventes.get(1)).toMatchObject({ notes: 'Pointé', montant: 100 })
  })
})
