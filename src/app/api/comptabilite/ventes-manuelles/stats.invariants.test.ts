import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { Devise } from '@/lib/territoires'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), aggregate: vi.fn(), exploitation: vi.fn(), enrichir: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'ferme-test' } } }),
}))
vi.mock('@/lib/prisma', () => ({ default: {
  venteManuelle: { findMany: mocks.findMany, aggregate: mocks.aggregate },
  exploitation: { findUnique: mocks.exploitation },
} }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/comptabilite/projection-reglements', () => ({ enrichirMiroirsReglements: mocks.enrichir }))
// Le faux stockage possède des contextes figés, même en validation publique.
// Le lecteur et la validation métier restent les vrais modules.
vi.mock('@prisma/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/client')>()
  return { ...original, Prisma: { ...original.Prisma,
    VenteManuelleScalarFieldEnum: { ...original.Prisma.VenteManuelleScalarFieldEnum, contexteFiscal: 'contexteFiscal' },
  } }
})

import { GET } from './route'

interface Vente {
  id: number
  userId: string
  montant: number
  contexteFiscal: unknown
  categorie: string
  paye: boolean
  date: Date
}
interface RequeteStockage {
  where: { userId?: string; categorie?: string; paye?: boolean; date?: { gte?: Date; lte?: Date } }
  take?: number
  select?: Record<string, boolean>
}
let ventes: Vente[]
const contexte = (devise: Devise) => ({
  version: 1, regimeTva: 'non-assujetti',
  territoire: devise === 'EUR' ? 'METROPOLE' : 'NOUVELLE_CALEDONIE',
  devise, date: '2026-11-01T12:00:00.000Z',
})
const vente = (id: number, montant: number, monnaie: Devise | null, autres: Partial<Vente> = {}): Vente => ({
  id, montant, userId: 'ferme-test', contexteFiscal: monnaie === null ? null : contexte(monnaie),
  categorie: 'legumes', paye: false, date: new Date('2026-11-10T00:00:00.000Z'), ...autres,
})
const filtrer = ({ where }: RequeteStockage) => ventes.filter(v =>
  (where.userId === undefined || v.userId === where.userId)
  && (where.categorie === undefined || v.categorie === where.categorie)
  && (where.paye === undefined || v.paye === where.paye)
  && (!where.date?.gte || v.date >= where.date.gte)
  && (!where.date?.lte || v.date <= where.date.lte),
)
const lire = async (params = '') => {
  const reponse = await GET(new NextRequest(`http://localhost/api/comptabilite/ventes-manuelles${params}`))
  expect(reponse.status).toBe(200)
  return reponse.json()
}

beforeEach(() => {
  vi.clearAllMocks()
  ventes = []
  mocks.exploitation.mockResolvedValue({ devise: 'XPF', territoire: 'NOUVELLE_CALEDONIE' })
  mocks.enrichir.mockImplementation(async (_userId, _type, lignes) => lignes)
  mocks.findMany.mockImplementation(async (requete: RequeteStockage) => {
    const lignes = filtrer(requete).slice(0, requete.take)
    return requete.select ? lignes.map(v => Object.fromEntries(
      Object.entries(v).filter(([champ]) => requete.select?.[champ]),
    )) : lignes
  })
  // Ancienne requête conservée dans le double pour reproduire le total mixte.
  mocks.aggregate.mockImplementation(async (requete: RequeteStockage) => ({
    _count: filtrer(requete).length,
    _sum: { montant: filtrer(requete).reduce((somme, v) => somme + v.montant, 0) },
  }))
})

describe('GET ventes manuelles — statistiques par devise', () => {
  it('sépare EUR et XPF figés malgré la devise courante, sans changer les lignes', async () => {
    ventes = [vente(1, 10.1, 'EUR'), vente(2, 20.2, 'EUR'), vente(3, 1500, 'XPF')]
    const json = await lire()
    expect(json.stats).toEqual({ count: 3, total: null, totalParDevise: [
      { monnaie: 'EUR', total: 30.3, count: 2 }, { monnaie: 'XPF', total: 1500, count: 1 },
    ] })
    expect(json.data.map((v: { monnaie: Devise }) => v.monnaie)).toEqual(['EUR', 'EUR', 'XPF'])
    expect(mocks.enrichir).toHaveBeenCalledWith('ferme-test', 'vente', ventes)
  })

  it.each(['EUR', 'XPF'] as const)('préserve le total mono-devise %s, y compris les avoirs', async monnaie => {
    ventes = [vente(1, 45.75, monnaie), vente(2, -5.25, monnaie)]
    expect((await lire()).stats).toEqual({ count: 2, total: 40.5,
      totalParDevise: [{ monnaie, total: 40.5, count: 2 }],
    })
  })

  it('renvoie zéro sans lignes et applique la devise courante aux ventes sans contexte', async () => {
    expect((await lire()).stats).toEqual({ count: 0, total: 0,
      totalParDevise: [{ monnaie: 'XPF', total: 0, count: 0 }],
    })
    ventes = [vente(1, 250, null)]
    expect((await lire()).stats).toEqual({ count: 1, total: 250,
      totalParDevise: [{ monnaie: 'XPF', total: 250, count: 1 }],
    })
  })

  it('limit=1 garde toutes les statistiques filtrées et exclut le tenant tiers', async () => {
    ventes = [vente(1, 12.5, 'EUR'), vente(2, 800, 'XPF'),
      vente(3, 90000, 'EUR', { userId: 'ferme-tiers' }),
      vente(4, 90000, 'EUR', { categorie: 'fruits' }),
      vente(5, 90000, 'EUR', { paye: true }),
      vente(6, 90000, 'EUR', { date: new Date('2026-10-31T23:59:59.999Z') }),
      vente(7, 90000, 'EUR', { date: new Date('2026-11-11T00:00:00.001Z') }),
    ]
    const filtre = '?categorie=legumes&paye=false&dateDebut=2026-11-01&dateFin=2026-11-11'
    const complet = await lire(filtre)
    const page = await lire(`${filtre}&limit=1`)
    expect(complet.data.map((v: { id: number }) => v.id)).toEqual([1, 2])
    expect(page.data.map((v: { id: number }) => v.id)).toEqual([1])
    expect(page.stats).toEqual(complet.stats)
    expect(page.stats).toEqual({ count: 2, total: null, totalParDevise: [
      { monnaie: 'EUR', total: 12.5, count: 1 }, { monnaie: 'XPF', total: 800, count: 1 },
    ] })
    expect(mocks.exploitation).toHaveBeenCalledWith({ where: { userId: 'ferme-test' }, select: { devise: true, territoire: true } })
  })

  it('groupe les contextes illisibles sous monnaie:null, sans repli sur XPF', async () => {
    ventes = [vente(1, 8.25, null, { contexteFiscal: { version: 1, devise: 'EUR' } }),
      vente(2, 1.75, null, { contexteFiscal: { ...contexte('XPF'), date: 'invalide' } }),
    ]
    expect((await lire()).stats).toEqual({ count: 2, total: 10,
      totalParDevise: [{ monnaie: null, total: 10, count: 2 }],
    })
    ventes.push(vente(3, 200, null))
    const json = await lire()
    expect(json.stats).toEqual({ count: 3, total: null, totalParDevise: [
      { monnaie: 'XPF', total: 200, count: 1 }, { monnaie: null, total: 10, count: 2 },
    ] })
    expect(json.data.map((v: { monnaie: Devise | null }) => v.monnaie)).toEqual([null, null, 'XPF'])
  })

  it('deux devises à solde nul restent deux groupes, donc aucun total global', async () => {
    ventes = [vente(1, 10, 'EUR'), vente(2, -10, 'EUR'), vente(3, 0, 'XPF')]
    expect((await lire()).stats).toEqual({ count: 3, total: null, totalParDevise: [
      { monnaie: 'EUR', total: 0, count: 2 }, { monnaie: 'XPF', total: 0, count: 1 },
    ] })
  })
})

const GRAINE = 20261118
describe(`Invariants des ventes manuelles — graine ${GRAINE}`, () => {
  it('300 jeux : centimes et comptes conservés par devise, hors tenant tiers et indépendamment de limit', async () => {
    let etat = GRAINE
    const suivant = (borne: number) => {
      etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
      return etat % borne
    }
    for (let essai = 0; essai < 300; essai++) {
      const attendus = new Map<Devise | null, { centimes: number; count: number }>()
      const courante: Devise = essai % 2 === 0 ? 'EUR' : 'XPF'
      mocks.exploitation.mockResolvedValue({ devise: courante })
      ventes = Array.from({ length: suivant(40) }, (_, id) => {
        const type = suivant(4)
        const monnaie = type === 0 ? 'EUR' : type === 1 ? 'XPF' : type === 2 ? null : courante
        const centimes = suivant(200001) - 100000
        const userId = suivant(5) === 0 ? 'ferme-tiers' : 'ferme-test'
        if (userId === 'ferme-test') {
          const groupe = attendus.get(monnaie) ?? { centimes: 0, count: 0 }
          attendus.set(monnaie, { centimes: groupe.centimes + centimes, count: groupe.count + 1 })
        }
        return vente(id, centimes / 100, monnaie, { userId,
          contexteFiscal: type === 2 ? { version: 99 } : type === 3 ? null : contexte(monnaie as Devise),
        })
      })
      if (attendus.size === 0) attendus.set(courante, { centimes: 0, count: 0 })
      const totalParDevise = (['EUR', 'XPF', null] as const).flatMap(monnaie => {
        const groupe = attendus.get(monnaie)
        return groupe ? [{ monnaie, total: groupe.centimes / 100, count: groupe.count }] : []
      })
      const json = await lire(`?limit=${1 + suivant(5)}`)
      expect(json.stats, `jeu ${essai}`).toEqual({ totalParDevise,
        count: totalParDevise.reduce((somme, g) => somme + g.count, 0),
        total: totalParDevise.length === 1 ? totalParDevise[0].total : null,
      })
    }
  })
})
