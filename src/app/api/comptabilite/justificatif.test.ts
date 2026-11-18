import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown> & { id: number; userId: string }
const etat = vi.hoisted(() => ({
  ventes: new Map<number, Ligne>(),
  depenses: new Map<number, Ligne>(),
  ecritures: vi.fn(),
  transaction: vi.fn(),
  writeFile: vi.fn(),
  seq: 100,
}))

function table(lignes: Map<number, Ligne>) {
  return {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      const ligne = [...lignes.values()].find(l => Object.entries(where).every(([k, v]) => l[k] === v))
      return ligne ? { ...ligne } : null
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      etat.ecritures(data)
      const ligne = { ...data, id: ++etat.seq } as Ligne
      lignes.set(ligne.id, ligne)
      return { ...ligne }
    },
    update: async ({ where, data }: { where: { id: number; userId: string }; data: Record<string, unknown> }) => {
      const ligne = lignes.get(where.id)!
      expect(where.userId).toBe(ligne.userId)
      etat.ecritures(data)
      Object.assign(ligne, data)
      return { ...ligne }
    },
  }
}

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'exploitation-fictive' } } }),
}))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/comptabilite/suivi-reglement-source', () => ({
  verifierPointageDetaille: async () => ({}),
  suiviReglementActif: async () => null,
}))
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), writeFile: etat.writeFile }))
vi.mock('@/lib/upload-garde', () => ({
  dossierEnvoi: () => '/stockage-fictif',
  refusEnvoiFichier: async () => null,
  extensionReelle: (buffer: Buffer) => {
    if (buffer[0] === 0x25) return 'pdf'
    if (buffer[0] === 0xff) return 'jpg'
    return 'png'
  },
}))
vi.mock('@/lib/prisma', () => {
  const db = {
    venteManuelle: table(etat.ventes),
    depenseManuelle: table(etat.depenses),
    $queryRaw: async () => [{ id: 1 }],
    $executeRaw: async () => 0,
  }
  return { default: { ...db, $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    etat.transaction()
    return fn(db)
  } } }
})

import { createVenteManuelleSchema, updateVenteManuelleSchema } from '@/lib/validations/vente-manuelle'
import { createDepenseManuelleSchema, updateDepenseManuelleSchema } from '@/lib/validations/depense-manuelle'
import { POST as televerser } from '@/app/api/upload/justificatif/route'
import { POST as postVente, PATCH as patchVente } from './ventes-manuelles/route'
import { POST as postDepense, PATCH as patchDepense } from './depenses-manuelles/route'

const finance = { montant: 120, tauxTVA: 20, montantHT: 100, montantTVA: 20, paye: false, modeReglement: 'Virement' }
const creation = { categorie: 'Autre', description: 'Écriture fictive', ...finance }
const nom = '123e4567-e89b-42d3-a456-426614174000.pdf'
const chemin = `/api/upload/justificatif/${nom}`
const anciennePiece = 'https://archives.example.test/ancienne-piece.pdf'
const ligne = (pjUrl: string, paye = false): Ligne => ({
  id: 1, userId: 'exploitation-fictive', auto: false, sourceType: null, sourceId: null,
  ...creation, paye, journal: 'OD', pjUrl,
})
const requete = (method: string, body: object) => new NextRequest('http://local.test/api/comptabilite', {
  method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

async function upload(ext: string) {
  const formats = {
    pdf: { type: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
    jpg: { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff, 0xe0] },
    png: { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  }
  const format = formats[ext as keyof typeof formats]
  const form = new FormData()
  form.set('file', new Blob([new Uint8Array(format.bytes)], { type: format.type }), `fictif.${ext}`)
  const res = await televerser(new NextRequest('http://local.test/api/upload/justificatif', { method: 'POST', body: form }))
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body).toEqual({ url: expect.any(String), filename: `fictif.${ext}`, size: format.bytes.length, empreinteSha256: expect.stringMatching(/^[a-f0-9]{64}$/) })
  expect(body.url).toMatch(new RegExp(`^/api/upload/justificatif/[a-f0-9-]{36}\\.${ext}$`))
  expect(etat.writeFile).toHaveBeenLastCalledWith(`/stockage-fictif/${body.url.split('/').at(-1)}`, Buffer.from(format.bytes))
  return body.url as string
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.ventes.clear()
  etat.depenses.clear()
  etat.seq = 100
})

describe('B9 — contrat entre le téléversement et les quatre schémas', () => {
  it.each(['pdf', 'jpg', 'png'])('accepte sans conversion le chemin %s réellement émis', async ext => {
    const pjUrl = await upload(ext)
    for (const schema of [createVenteManuelleSchema, createDepenseManuelleSchema, updateVenteManuelleSchema, updateDepenseManuelleSchema]) {
      const parsed = schema.safeParse({ ...creation, id: 1, pjUrl })
      expect(parsed.success).toBe(true)
      if (parsed.success) expect(parsed.data.pjUrl).toBe(pjUrl)
    }
  })
})

const refus = [
  anciennePiece, `https://gleba.fr${chemin}`, `//hote.test${chemin}`, 'javascript:alert(1)', 'data:application/pdf;base64,AAAA',
  `/tmp/${nom}`, `api/upload/justificatif/${nom}`, `/api/upload/photo/${nom}`, `/api/upload/justificatifs/${nom}`,
  '/api/upload/justificatif/invalide.pdf', chemin.replace('-42d3-', '-12d3-'), chemin.replace('-a456-', '-7456-'),
  chemin.replace('.pdf', '.svg'), chemin.replace('.pdf', '.jpeg'), `${chemin}.html`, `${chemin}?x=1`, `${chemin}#fragment`,
  `${chemin}\n`, ` ${chemin}`, `${chemin}/autre`, `/api/upload/justificatif/../${nom}`,
  `/api/upload/justificatif/%2e%2e/${nom}`, `/api/upload/justificatif/%252e%252e%252f${nom}`,
  `/api/upload/justificatif/..\\${nom}`, `/api/upload/justificatif/%2f${nom}`, 42, {}, [], true,
]

for (const surface of [
  { nom: 'vente', post: postVente, patch: patchVente, lignes: etat.ventes },
  { nom: 'dépense', post: postDepense, patch: patchDepense, lignes: etat.depenses },
]) {
  for (const methode of ['POST', 'PATCH'] as const) {
    const appeler = (pj: Record<string, unknown>) => (methode === 'POST' ? surface.post : surface.patch)(
      requete(methode, { ...(methode === 'POST' ? creation : { id: 1 }), ...pj }),
    )
    describe(`${methode} ${surface.nom} — justificatif`, () => {
      it.each(['pdf', 'jpg', 'png'])('sauvegarde exactement le chemin %s sans altérer les montants ou le règlement', async ext => {
        const pjUrl = await upload(ext)
        surface.lignes.set(1, ligne(anciennePiece))
        const res = await appeler({ pjUrl })
        expect(res.status).toBe(methode === 'POST' ? 201 : 200)
        const body = await res.json()
        const saved = methode === 'PATCH' && surface.nom === 'vente' ? body.data : body
        expect(saved).toMatchObject({ ...finance, pjUrl })
        expect(surface.lignes.get(saved.id)).toMatchObject({ ...finance, pjUrl })
      })

      it.each([null, ''])('retient une pièce nulle pour %j', async pjUrl => {
        surface.lignes.set(1, ligne(anciennePiece))
        const res = await appeler({ pjUrl })
        expect(res.status).toBe(methode === 'POST' ? 201 : 200)
        expect(surface.lignes.get(methode === 'POST' ? 101 : 1)).toMatchObject({ ...finance, pjUrl: null })
      })

      it.each([chemin, anciennePiece])('respecte l’omission avec une pièce existante %s', async pjUrl => {
        const avant = ligne(pjUrl, true)
        surface.lignes.set(1, { ...avant })
        const res = await appeler({})
        expect(res.status).toBe(methode === 'POST' ? 201 : 200)
        if (methode === 'PATCH') expect(surface.lignes.get(1)).toEqual(avant)
        else expect(surface.lignes.get(101)).toMatchObject({ ...finance, pjUrl: null })
      })

      it('conserve aussi un règlement déjà payé lors de l’affectation ou du retrait', async () => {
        for (const pjUrl of [chemin, null, '']) {
          surface.lignes.set(1, ligne(anciennePiece, true))
          const res = await appeler({ pjUrl, ...(methode === 'POST' ? { paye: true } : {}) })
          expect(res.status).toBe(methode === 'POST' ? 201 : 200)
          const body = await res.json()
          const saved = methode === 'PATCH' && surface.nom === 'vente' ? body.data : body
          expect(surface.lignes.get(saved.id)).toMatchObject({ ...finance, paye: true, pjUrl: pjUrl || null })
        }
      })

      it.each(refus)('refuse %j en 400 avec erreur accentuée et aucune écriture', async pjUrl => {
        surface.lignes.set(1, ligne(anciennePiece))
        const avant = [...surface.lignes.values()].map(l => ({ ...l }))
        const res = await appeler({ pjUrl })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({
          error: 'Données invalides',
          details: { formErrors: [], fieldErrors: { pjUrl: ['Pièce justificative invalide : utilisez le chemin du fichier téléversé.'] } },
        })
        expect(etat.ecritures).not.toHaveBeenCalled()
        expect(etat.transaction).not.toHaveBeenCalled()
        expect([...surface.lignes.values()]).toEqual(avant)
      })
    })
  }
}
