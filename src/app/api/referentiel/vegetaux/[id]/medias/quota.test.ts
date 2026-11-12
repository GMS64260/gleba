/**
 * SEC-03 (revue Codex du 2026-11-12) : les photos proposées au référentiel
 * public ne peuvent plus remplir le disque.
 *
 * Chaque envoi (8 Mo au plus, 15 par minute) stockait deux JPEG sous
 * `public/uploads/referentiel/membre`, hors du dossier et du quota du compte,
 * sans plafond cumulé ni borne des propositions en attente : un compte
 * gratuit pouvait accumuler des fichiers sans limite. La route réserve
 * désormais la contribution sous verrou (par exploitation puis par acteur)
 * avant d'écrire le moindre fichier.
 *
 * Route réelle, garde `membreEncyclopedie` réelle (compte démo compris) ;
 * stockage des images remplacé, fausse table des médias.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Media = { id: string; contributeurId: string; source: string; statut: string; createdAt: Date }

const m = vi.hoisted(() => ({
  medias: [] as Array<{ id: string; contributeurId: string; source: string; statut: string; createdAt: Date }>,
  membres: [] as Array<{ proprietaireId: string; userId: string; revoqueLe: Date | null }>,
  email: 'maraicher@example.com',
  stocker: vi.fn(),
  verrous: new Map<string, Promise<void>>(),
}))

function correspond(media: Media, where: Record<string, unknown>) {
  return Object.entries(where).every(([k, v]) => {
    const val = (media as Record<string, unknown>)[k]
    if (v && typeof v === 'object' && 'in' in (v as object)) return (v as { in: unknown[] }).in.includes(val)
    if (v && typeof v === 'object' && 'gte' in (v as object)) return (val as Date) >= (v as { gte: Date }).gte
    return val === v
  })
}

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'ferme-1', acteurId: 'acteur-1', role: 'USER' } } }),
}))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => null, getClientIP: () => 'test' }))
vi.mock('@/lib/media-storage', () => ({
  verifierTailleImage: () => undefined,
  stockerImageReferentiel: m.stocker,
  supprimerImagesStockees: vi.fn(),
}))
vi.mock('@/lib/prisma', () => {
  const mediaReferentiel = {
    count: async ({ where }: { where: Record<string, unknown> }) => m.medias.filter((x) => correspond(x, where)).length,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const media = { id: `m${m.medias.length + 1}`, createdAt: new Date(), ...data } as Media
      m.medias.push(media)
      return { id: media.id, statut: media.statut }
    },
  }
  const membreExploitation = {
    findMany: async ({ where }: { where: { proprietaireId: string } }) =>
      m.membres.filter((x) => x.proprietaireId === where.proprietaireId && x.revoqueLe === null).map((x) => ({ userId: x.userId })),
  }
  const db = {
    user: { findUnique: async () => ({ id: 'acteur-1', email: m.email, active: true, role: 'USER' }) },
    espece: { findFirst: async () => ({ id: 'tomate' }) },
    mediaReferentiel,
    membreExploitation,
  }
  return {
    default: {
      ...db,
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const liberations: Array<() => void> = []
        const tx = {
          ...db,
          // pg_advisory_xact_lock : la clé est le texte interpolé.
          $executeRaw: async (_s: TemplateStringsArray, cle: string) => {
            const precedent = m.verrous.get(cle) ?? Promise.resolve()
            let liberer!: () => void
            m.verrous.set(cle, new Promise<void>((r) => { liberer = r }))
            liberations.push(liberer)
            await precedent
            return 0
          },
        }
        try {
          return await fn(tx)
        } finally {
          liberations.forEach((l) => l())
        }
      },
    },
  }
})

import { POST } from './route'

const envoyer = () => {
  const fd = new FormData()
  fd.set('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), 'photo.jpg')
  fd.set('auteur', 'Jardinier')
  fd.set('confirmationDroits', 'true')
  fd.set('acceptationLicence', 'true')
  return POST(new NextRequest('http://local.test/api/referentiel/vegetaux/tomate/medias', { method: 'POST', body: fd }), {
    params: Promise.resolve({ id: 'tomate' }),
  })
}

const ajouter = (n: number, contributeurId: string, statut = 'PROPOSE', il_y_a_jours = 0) => {
  for (let i = 0; i < n; i++) {
    m.medias.push({
      id: `x${m.medias.length}`, contributeurId, source: 'MEMBRE', statut,
      createdAt: new Date(Date.now() - il_y_a_jours * 86_400_000),
    })
  }
}

beforeEach(() => {
  m.medias = []
  m.membres = [{ proprietaireId: 'ferme-1', userId: 'acteur-1', revoqueLe: null }, { proprietaireId: 'ferme-1', userId: 'acteur-2', revoqueLe: null }]
  m.email = 'maraicher@example.com'
  m.verrous.clear()
  m.stocker.mockReset().mockImplementation(async () => ({ url: '/u/a.jpg', miniatureUrl: '/u/a-360.jpg', absolutePaths: [] }))
})

describe('SEC-03 : quotas des photos proposées au référentiel', () => {
  it('sous les plafonds, la proposition est enregistrée', async () => {
    const res = await envoyer()
    expect(res.status).toBe(201)
    expect(m.stocker).toHaveBeenCalledOnce()
  })

  it('le compte de démonstration est refusé avant tout stockage', async () => {
    m.email = 'demo@gleba.fr'
    const res = await envoyer()
    expect(res.status).toBe(403)
    expect(m.stocker).not.toHaveBeenCalled()
  })

  it('trop de propositions en attente pour l’acteur : refus, aucun fichier écrit', async () => {
    ajouter(10, 'acteur-1')
    const res = await envoyer()
    expect(res.status).toBe(429)
    expect((await res.json()).code).toBe('QUOTA_CONTRIBUTIONS_MEDIAS')
    expect(m.stocker).not.toHaveBeenCalled()
  })

  it('trop de propositions en attente pour l’exploitation (autres membres compris) : refus', async () => {
    ajouter(30, 'acteur-2')
    const res = await envoyer()
    expect(res.status).toBe(429)
    expect(m.stocker).not.toHaveBeenCalled()
  })

  it('quota glissant sur 30 jours, rejets et validations compris : refus', async () => {
    ajouter(40, 'acteur-1', 'REJETE', 3)
    ajouter(20, 'acteur-1', 'VALIDE', 10)
    const res = await envoyer()
    expect(res.status).toBe(429)
    expect(m.stocker).not.toHaveBeenCalled()
  })

  it('les propositions de plus de 30 jours ne comptent plus dans le quota glissant', async () => {
    ajouter(60, 'acteur-1', 'VALIDE', 45)
    expect((await envoyer()).status).toBe(201)
  })

  it('réservation atomique : à 9 en attente, deux envois simultanés n’en font passer qu’un', async () => {
    ajouter(9, 'acteur-1')
    const [a, b] = await Promise.all([envoyer(), envoyer()])
    expect([a.status, b.status].sort()).toEqual([201, 429])
    expect(m.stocker).toHaveBeenCalledOnce()
  })
})
