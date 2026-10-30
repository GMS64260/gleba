import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'

const auth = vi.hoisted(() => ({ id: '' }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: async () => ({ error: null,
  session: { user: { id: auth.id, acteurId: auth.id, peutEcrireExploitation: true, estProprietaireExploitation: true } },
}) }))

import db from '@/lib/prisma'
import { GET as lister, POST as transformer } from '@/app/api/arbres/transformations/route'
import { DELETE as annuler } from '@/app/api/arbres/transformations/[id]/route'
import { DELETE as supprimerFruit } from '@/app/api/arbres/recoltes/[id]/route'
import { DELETE as annulerSortieFruit } from '@/app/api/arbres/recoltes/[id]/sorties/[sortieId]/route'
import { chargerCatalogueStock } from '@/lib/commercial/catalogue-stock'
import { retournerStockCommercial } from '@/lib/commercial/stock'
import { creerDocument, agirSurDocument } from '@/lib/commercial/service'
import { contenuDocumentSchema } from '@/lib/commercial/regles'
import { exportAccount, importAccount } from '@/lib/account-transfer'

// Retour FB-8CXUUN (2026-10-30) : le produit d'une transformation interne
// entre en stock, vendable par BL ou facture, avec la trace de ses fruits.
const maintenant = new Date('2026-10-28T12:00:00Z')
const hier = new Date('2026-10-27T12:00:00Z')
const jour = '2026-10-28'
let arbreId: number
let clientId: number
const req = (url: string, method: string, body?: object) => new NextRequest('http://localhost' + url, {
  method, ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
})
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const fruit = (data: object = {}) => db.recolteArbre.create({ data: { userId: auth.id, arbreId, date: hier, quantite: 10, prixKg: 2, ...data } })
const saisie = (sources: { fruitId: number; quantite: number }[], data: object = {}) => ({
  sources, produit: 'Jus de pomme', quantite: 6, unite: 'bouteille', date: jour, datePeremption: '2027-10-28',
  prixUnitaire: 4.5, tauxTVA: 5.5, cleIdempotence: randomUUID(), ...data,
})
const creer = (corps: object) => transformer(req('/api/arbres/transformations', 'POST', corps))

async function livrer(id: number, quantite: number) {
  const contenu = contenuDocumentSchema.parse({ type: 'livraison', clientId, date: jour, dateValidite: null, dateLivraison: null,
    objet: 'Livraison de contrôle', lignes: [{ description: 'Jus fictif', quantite, unite: 'bouteille', prixUnitaire: 4, tauxTVA: 5.5,
      articleStockType: 'transforme', articleStockId: String(id) }] })
  const document = await creerDocument(auth.id, randomUUID(), contenu)
  await agirSurDocument(auth.id, document.id, 'emettre')
  await agirSurDocument(auth.id, document.id, 'livrer', jour)
  return document
}

describe.skipIf(!process.env.GLEBA_VERGER_QA_DATABASE_URL)('Produits transformés du verger sur PostgreSQL', () => {
  beforeAll(() => {
    const url = process.env.DATABASE_URL || ''
    if (url !== process.env.GLEBA_VERGER_QA_DATABASE_URL || !/^\/gleba_verger_qa_corrige_20261028_[0-9a-f]{8}$/.test(new URL(url).pathname)) {
      throw new Error('Base PostgreSQL QA vide dédiée obligatoire')
    }
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(maintenant)
  })
  beforeEach(async () => {
    const user = await db.user.create({ data: { email: 'qa-transfo-' + randomUUID() + '@example.org', emailVerified: true } })
    auth.id = user.id
    await db.exploitation.create({ data: { userId: auth.id, raisonSociale: 'Ferme fictive', formeJuridique: 'EI',
      regimeFiscal: 'micro-BA', regimeTva: 'reel-normal', emailContact: 'qa@example.org',
      adresseSiege: '1 voie fictive', codePostal: '64000', ville: 'Essai' } })
    arbreId = (await db.arbre.create({ data: { userId: auth.id, nom: 'Pommier fictif', type: 'fruitier', espece: 'Pommier', posX: 0, posY: 0 } })).id
    clientId = (await db.client.create({ data: { userId: auth.id, nom: 'Client fictif' } })).id
  })
  afterAll(async () => { vi.useRealTimers(); await db.$disconnect() })

  it('sort les fruits de plusieurs lots et met le produit en stock, une seule fois par référence', async () => {
    const a = await fruit({ statutBioSnapshot: 'AB' })
    const b = await fruit({ quantite: 5, statutBioSnapshot: 'C2' })
    const corps = saisie([{ fruitId: a.id, quantite: 4 }, { fruitId: b.id, quantite: 5 }])
    const res = await creer(corps)
    expect(res.status).toBe(201)
    const lot = await res.json()
    expect(lot).toMatchObject({ produit: 'Jus de pomme', quantite: 6, unite: 'bouteille', stockDisponibleCommercial: 6, statutBioSnapshot: 'C2', tauxTVA: 5.5 })
    expect(lot.numLot).toMatch(/^20261028-TR-/)
    expect((await db.recolteArbre.findUniqueOrThrow({ where: { id: a.id } })).stockDisponibleCommercial).toBe(6)
    expect((await db.recolteArbre.findUniqueOrThrow({ where: { id: b.id } })).stockDisponibleCommercial).toBe(0)
    expect(await db.mouvementStockCommercial.findMany({ where: { userId: auth.id }, orderBy: { quantite: 'asc' } }))
      .toMatchObject([{ nature: 'transforme', fruitId: a.id, quantite: 4, transformationId: lot.id }, { nature: 'transforme', fruitId: b.id, quantite: 5, transformationId: lot.id }])
    // Reprise réseau : même référence, aucun doublon.
    expect((await creer(corps)).status).toBe(201)
    expect(await db.lotTransforme.count({ where: { userId: auth.id } })).toBe(1)
    expect(await db.mouvementStockCommercial.count({ where: { userId: auth.id } })).toBe(2)
    const liste = await (await lister()).json()
    expect(liste).toMatchObject([{ id: lot.id, annulable: true, sources: [{ quantite: expect.any(Number) }, { quantite: expect.any(Number) }] }])
  })

  it('refuse plus de fruits que le reliquat, une bouteille fractionnée et une date future, sans rien écrire', async () => {
    const a = await fruit()
    expect((await creer(saisie([{ fruitId: a.id, quantite: 11 }]))).status).toBe(409)
    expect((await creer(saisie([{ fruitId: a.id, quantite: 2 }], { quantite: 2.5 }))).status).toBe(400)
    expect((await creer(saisie([{ fruitId: a.id, quantite: 2 }], { date: '2026-10-29' }))).status).toBe(400)
    expect((await creer(saisie([{ fruitId: a.id, quantite: 2 }, { fruitId: a.id, quantite: 1 }]))).status).toBe(400)
    expect(await db.lotTransforme.count({ where: { userId: auth.id } })).toBe(0)
    expect((await db.recolteArbre.findUniqueOrThrow({ where: { id: a.id } })).stockDisponibleCommercial).toBeNull()
  })

  it('protège la trace des fruits : ni annulation de la sortie seule ni suppression du lot de fruits', async () => {
    const a = await fruit()
    const lot = await (await creer(saisie([{ fruitId: a.id, quantite: 3 }]))).json()
    const sortie = await db.mouvementStockCommercial.findFirstOrThrow({ where: { userId: auth.id, transformationId: lot.id } })
    const refus = await annulerSortieFruit(req(`/api/arbres/recoltes/${a.id}/sorties/${sortie.id}`, 'DELETE'), { params: Promise.resolve({ id: String(a.id), sortieId: sortie.id }) })
    expect(refus.status).toBe(409)
    expect((await refus.json()).error).toContain('Produits transformés')
    expect((await supprimerFruit(req('/api/arbres/recoltes/' + a.id, 'DELETE'), params(a.id))).status).toBe(409)
    expect(await db.mouvementStockCommercial.count({ where: { id: sortie.id } })).toBe(1)
  })

  it('annule une transformation jamais livrée : les fruits reviennent et le lot redevient libre', async () => {
    const a = await fruit()
    const lot = await (await creer(saisie([{ fruitId: a.id, quantite: 10 }]))).json()
    expect((await annuler(req('/api/arbres/transformations/' + lot.id, 'DELETE'), params(lot.id))).status).toBe(200)
    expect(await db.lotTransforme.count({ where: { userId: auth.id } })).toBe(0)
    expect(await db.mouvementStockCommercial.count({ where: { userId: auth.id } })).toBe(0)
    expect((await db.recolteArbre.findUniqueOrThrow({ where: { id: a.id } })).stockDisponibleCommercial).toBeNull()
    expect((await supprimerFruit(req('/api/arbres/recoltes/' + a.id, 'DELETE'), params(a.id))).status).toBe(200)
  })

  it('se vend par BL depuis le catalogue, se retourne, et reste conservé une fois livré', async () => {
    const a = await fruit()
    const lot = await (await creer(saisie([{ fruitId: a.id, quantite: 8 }]))).json()
    expect((await chargerCatalogueStock(auth.id, db, maintenant)).find(x => x.type === 'transforme'))
      .toMatchObject({ id: String(lot.id), nom: `Jus de pomme · ${lot.numLot}`, categorie: 'Produits transformés', disponible: 6, unite: 'bouteille', prixTTC: 4.5, tauxTVA: 5.5 })
    const bl = await livrer(lot.id, 4)
    expect((await db.lotTransforme.findUniqueOrThrow({ where: { id: lot.id } })).stockDisponibleCommercial).toBe(2)
    expect(await db.mouvementStockCommercial.findFirst({ where: { userId: auth.id, documentId: bl.id } })).toMatchObject({ lotTransformeId: lot.id, quantite: 4, nature: 'livraison' })
    await expect(livrer(lot.id, 3)).rejects.toThrow(/insuffisant|plus disponible/i)
    const refus = await annuler(req('/api/arbres/transformations/' + lot.id, 'DELETE'), params(lot.id))
    expect(refus.status).toBe(409)
    await db.$transaction(tx => retournerStockCommercial(tx, auth.id, { documentId: bl.id }))
    expect((await db.lotTransforme.findUniqueOrThrow({ where: { id: lot.id } })).stockDisponibleCommercial).toBe(6)
    expect((await annuler(req('/api/arbres/transformations/' + lot.id, 'DELETE'), params(lot.id))).status).toBe(409)
  })

  it('suit le compte lors d’un transfert : lot, sources et livraisons rattachés aux nouveaux identifiants', async () => {
    const a = await fruit()
    const lot = await (await creer(saisie([{ fruitId: a.id, quantite: 5 }]))).json()
    await livrer(lot.id, 2)
    const contenu = await exportAccount(auth.id)
    const autre = await db.user.create({ data: { email: `import-${randomUUID()}@example.test` } })
    await db.user.delete({ where: { id: auth.id } })
    const transfert = await importAccount(autre.id, contenu)
    expect(transfert.skipped.LotTransforme ?? 0).toBe(0)
    expect(transfert.skipped.MouvementStockCommercial ?? 0).toBe(0)
    const importe = await db.lotTransforme.findFirstOrThrow({ where: { userId: autre.id } })
    expect(importe).toMatchObject({ produit: 'Jus de pomme', stockDisponibleCommercial: 4 })
    expect(await db.mouvementStockCommercial.findFirst({ where: { userId: autre.id, nature: 'transforme' } })).toMatchObject({ transformationId: importe.id, quantite: 5 })
    expect(await db.mouvementStockCommercial.findFirst({ where: { userId: autre.id, nature: 'livraison' } })).toMatchObject({ lotTransformeId: importe.id, articleStockId: String(importe.id) })
  })
})
