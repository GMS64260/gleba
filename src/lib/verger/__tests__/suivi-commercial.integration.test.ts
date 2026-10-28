import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
const auth = vi.hoisted(() => ({ id: '' }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: async () => ({ error: null, session: { user: { id: auth.id, acteurId: auth.id, estProprietaireExploitation: true, peutEcrireExploitation: true } } }) }))
import db from '@/lib/prisma'
import { GET as LISTER_FRUITS } from '@/app/api/arbres/recoltes/route'
import { GET as LISTER_BOIS } from '@/app/api/arbres/bois/route'
import { PATCH as VENDRE_BOIS } from '@/app/api/arbres/bois/[id]/route'
import { contenuDocumentSchema } from '@/lib/commercial/regles'
import { creerDocument, agirSurDocument, facturerDocuments } from '@/lib/commercial/service'
import { chargerCatalogueStock } from '@/lib/commercial/catalogue-stock'
import { chargerSuiviCommercialVerger } from '@/lib/verger/suivi-commercial'
import { dateIsoFacture } from '@/lib/facture-regles'
import { computeTvaPeriode } from '@/lib/kpi/tva'
import { TAUX_TVA_BOIS_PAR_DEFAUT } from '@/lib/verger/tva-bois'
import type { VenteCommercialeVerger } from '@/lib/verger/suivi-commercial-types'

const jour = dateIsoFacture(new Date())
const hier = new Date(Date.now() - 86_400_000)
let arbreId: number, clientId: number
const req = (path: string) => new NextRequest('http://localhost' + path)
const lotFruit = () => db.recolteArbre.create({ data: { userId: auth.id, arbreId, date: hier, quantite: 10 } })
const lotBois = () => db.productionBois.create({ data: { userId: auth.id, arbreId, date: hier, type: 'elagage', volumeM3: 1.4, volumeStere: 2, prixVente: 110 } })
async function document(typeStock: 'fruit' | 'bois', id: number, quantite: number, prixHT = 3, tauxTVA = 0, type: 'livraison' | 'devis' = 'livraison') {
  const contenu = contenuDocumentSchema.parse({ type, clientId, date: jour, dateValidite: type === 'devis' ? jour : null, dateLivraison: null, objet: 'Vente fictive du banc',
    lignes: [{ description: 'Produit fictif', quantite, unite: typeStock === 'fruit' ? 'kg' : 'stère', prixUnitaire: prixHT, tauxTVA, articleStockType: typeStock, articleStockId: String(id) }] })
  const d = await creerDocument(auth.id, randomUUID(), contenu)
  await agirSurDocument(auth.id, d.id, 'emettre')
  await agirSurDocument(auth.id, d.id, type === 'livraison' ? 'livrer' : 'accepter', jour)
  return d
}
async function fruits() {
  const r = await LISTER_FRUITS(req('/api/arbres/recoltes'))
  expect(r.status).toBe(200)
  return r.json() as Promise<Array<{ id: number; statut: string; stockDisponibleCommercial: number; ventesCommerciales: VenteCommercialeVerger[] }>>
}
async function avoir(factureId: number, montant: number, lotId?: number) {
  return db.facture.create({ data: { userId: auth.id, numero: 'AV-TEST-' + randomUUID(), type: 'avoir', factureOrigineId: factureId,
    clientNom: 'Client fictif', totalHT: montant, totalTTC: montant, totalTVA: 0, statut: 'emise',
    emetteurSnapshot: { devise: 'EUR' }, lignes: { create: { description: 'Correction fictive', quantite: 1, unite: 'kg', prixUnitaire: montant,
      tauxTVA: 0, montantHT: montant, montantTVA: 0, montantTTC: montant, ...(lotId == null ? {} : { articleStockType: 'fruit', articleStockId: String(lotId) }) } } } })
}

describe.skipIf(!process.env.GLEBA_VERGER_BL_QA_DATABASE_URL)('Productions et documents commerciaux sur PostgreSQL dédié', () => {
  beforeAll(() => {
    const url = process.env.DATABASE_URL || ''
    if (url !== process.env.GLEBA_VERGER_BL_QA_DATABASE_URL || !/^\/gleba_verger_bl_qa_20261028_[0-9a-f]{8}$/.test(new URL(url).pathname)) throw new Error('Base QA BL dédiée obligatoire')
  })
  beforeEach(async () => {
    const u = await db.user.create({ data: { email: 'bl-verger-' + randomUUID() + '@example.test', emailVerified: true } })
    auth.id = u.id
    await db.exploitation.create({ data: { userId: auth.id, raisonSociale: 'Exploitation fictive', formeJuridique: 'EI', regimeFiscal: 'micro-BA',
      adresseSiege: '1 voie fictive', codePostal: '64000', ville: 'Essai', emailContact: 'fictif@example.test', regimeTva: 'reel-normal' } })
    arbreId = (await db.arbre.create({ data: { userId: auth.id, nom: 'Arbre fictif', type: 'fruitier', espece: 'Pommier', posX: 0, posY: 0 } })).id
    clientId = (await db.client.create({ data: { userId: auth.id, nom: 'Client fictif' } })).id
  })
  afterAll(() => db.$disconnect())

  it('livraison partielle visible, puis même livraison facturée sans doubler quantité ni recette', async () => {
    const r = await lotFruit(), bl = await document('fruit', r.id, 4)
    let ligne = (await fruits()).find(l => l.id === r.id)!
    expect(ligne.statut).toBe('en_stock'); expect(ligne.stockDisponibleCommercial).toBe(6)
    expect(ligne.ventesCommerciales).toHaveLength(1)
    expect(ligne.ventesCommerciales[0]).toMatchObject({ quantiteLivree: 4, quantiteNette: 4, revenuTTC: 0, montantLivre: 12, facture: null })
    const f = await facturerDocuments(auth.id, [bl.id], jour)
    ligne = (await fruits()).find(l => l.id === r.id)!
    expect(ligne.ventesCommerciales).toHaveLength(1)
    expect(ligne.ventesCommerciales[0]).toMatchObject({ quantiteNette: 4, revenuTTC: 12, facture: { id: f.id } })
    expect(await db.mouvementStockCommercial.count({ where: { userId: auth.id } })).toBe(1)
  })

  it('deux BL du même lot facturés ensemble donnent une seule recette et gardent les deux pièces', async () => {
    const r = await lotFruit(), b1 = await document('fruit', r.id, 4), b2 = await document('fruit', r.id, 6)
    await facturerDocuments(auth.id, [b1.id, b2.id], jour)
    const ligne = (await fruits()).find(l => l.id === r.id)!
    expect(ligne.stockDisponibleCommercial).toBe(0)
    expect(ligne.ventesCommerciales).toHaveLength(1)
    expect(ligne.ventesCommerciales[0]).toMatchObject({ quantiteLivree: 10, quantiteNette: 10, revenuTTC: 30 })
    expect(ligne.ventesCommerciales[0].documents.map(d => d.id).sort()).toEqual([b1.id, b2.id].sort())
  })

  it('retour non facturé : stock reconstitué et livraison conservée hors chiffre d’affaires', async () => {
    const r = await lotFruit(), bl = await document('fruit', r.id, 4)
    await agirSurDocument(auth.id, bl.id, 'retourner')
    const ligne = (await fruits()).find(l => l.id === r.id)!
    expect(ligne.stockDisponibleCommercial).toBe(10)
    expect(ligne.ventesCommerciales[0]).toMatchObject({ quantiteLivree: 4, quantiteRetournee: 4, quantiteNette: 0, revenuTTC: 0 })
  })

  it('avoir et retour se lisent séparément ; un avoir brouillon ne réduit pas la recette', async () => {
    const r = await lotFruit(), bl = await document('fruit', r.id, 4), f = await facturerDocuments(auth.id, [bl.id], jour)
    const brouillon = await avoir(f.id, 5, r.id)
    await db.facture.update({ where: { id: brouillon.id }, data: { statut: 'brouillon' } })
    await avoir(f.id, 3, r.id)
    let vente = (await fruits())[0].ventesCommerciales[0]
    expect(vente).toMatchObject({ quantiteNette: 4, quantiteRetournee: 0, revenuTTC: 9, montantAvoirs: 3 })
    await avoir(f.id, 9, r.id)
    await agirSurDocument(auth.id, bl.id, 'retourner')
    vente = (await fruits())[0].ventesCommerciales[0]
    expect(vente).toMatchObject({ quantiteNette: 0, quantiteRetournee: 4, revenuTTC: 0, montantAvoirs: 12 })
  })

  it('une facture de stock issue d’un devis reste visible sans BL ni seconde sortie', async () => {
    const r = await lotFruit(), devis = await document('fruit', r.id, 4, 3, 0, 'devis')
    const f = await facturerDocuments(auth.id, [devis.id], jour)
    const ligne = (await fruits())[0]
    expect(ligne.ventesCommerciales[0]).toMatchObject({ quantiteNette: 4, revenuTTC: 12, facture: { id: f.id } })
    expect(ligne.ventesCommerciales[0].documents).toEqual([])
  })

  it('l’avoir libre d’une facture multilot est signalé sans inventer sa ventilation', async () => {
    const r1 = await lotFruit(), r2 = await lotFruit()
    const b1 = await document('fruit', r1.id, 4), b2 = await document('fruit', r2.id, 2)
    const f = await facturerDocuments(auth.id, [b1.id, b2.id], jour)
    await avoir(f.id, 3)
    const lignes = await fruits()
    expect(lignes.every(r => r.ventesCommerciales[0].revenuTTC === null)).toBe(true)
    expect(lignes.map(r => r.ventesCommerciales[0].quantiteNette).sort()).toEqual([2, 4])
  })

  it('l’avoir libre d’une facture portant un seul lot se déduit sans ambiguïté', async () => {
    const r = await lotFruit(), bl = await document('fruit', r.id, 4), f = await facturerDocuments(auth.id, [bl.id], jour)
    await avoir(f.id, 3)
    expect((await fruits())[0].ventesCommerciales[0]).toMatchObject({ revenuTTC: 9, montantAvoirs: 3, quantiteNette: 4 })
  })

  it('les mouvements et factures d’un autre propriétaire restent invisibles', async () => {
    const r = await lotFruit(), bl = await document('fruit', r.id, 4)
    await facturerDocuments(auth.id, [bl.id], jour)
    const autre = await db.user.create({ data: { email: randomUUID() + '@example.test' } })
    expect((await chargerSuiviCommercialVerger(autre.id, 'fruit', [r.id])).size).toBe(0)
    auth.id = autre.id
    expect(await fruits()).toEqual([])
  })

  it('bois : catalogue et factures native/BL utilisent le même défaut, quantités conservées en stères', async () => {
    const b1 = await lotBois(), b2 = await lotBois()
    const catalogue = await chargerCatalogueStock(auth.id)
    expect(catalogue.find(a => a.type === 'bois' && a.id === String(b2.id))?.tauxTVA).toBe(TAUX_TVA_BOIS_PAR_DEFAUT)
    const native = await VENDRE_BOIS(new NextRequest('http://localhost/api/arbres/bois/' + b1.id, { method: 'PATCH', body: JSON.stringify({ statut: 'vendu', prixVente: 110, creerFacture: true }), headers: { 'content-type': 'application/json' } }), { params: Promise.resolve({ id: String(b1.id) }) })
    expect(native.status).toBe(200)
    const bl = await document('bois', b2.id, 1, 50, TAUX_TVA_BOIS_PAR_DEFAUT)
    const f = await facturerDocuments(auth.id, [bl.id], jour)
    const fNative = await db.facture.findFirstOrThrow({ where: { userId: auth.id, productionsBois: { some: { id: b1.id } } }, include: { lignes: true } })
    expect(fNative.lignes[0].tauxTVA).toBe(f.lignes[0].tauxTVA)
    expect(fNative.totalTVA).toBeCloseTo(10)
    expect(f.totalTVA).toBeCloseTo(5)
    const response = await LISTER_BOIS(req('/api/arbres/bois'))
    expect(response.status).toBe(200)
    const lignes = await response.json()
    expect(lignes.find((b: { id: number }) => b.id === b2.id).ventesCommerciales[0]).toMatchObject({ quantiteNette: 1, unite: 'stère', revenuTTC: 55 })
    const tva = await computeTvaPeriode(auth.id, new Date(new Date().getFullYear(), 0, 1), new Date(new Date().getFullYear(), 11, 31, 23, 59, 59))
    expect(tva.collectee.total).toBeCloseTo(15)
  })

  it('un taux choisi de 20 sur un ancien BL reste figé après alignement du catalogue', async () => {
    const b = await lotBois(), bl = await document('bois', b.id, 1, 50, 20)
    const f = await facturerDocuments(auth.id, [bl.id], jour)
    expect(f.lignes[0].tauxTVA).toBe(20)
    expect(f.totalTVA).toBe(10)
    expect((await chargerCatalogueStock(auth.id)).find(a => a.type === 'bois')?.tauxTVA).toBe(10)
  })

  it('la lecture du catalogue accepte la production du même jour et exclut celle de demain', async () => {
    const r = await lotFruit(), b = await lotBois()
    const tard = new Date(); tard.setHours(23, 59, 0, 0)
    const demain = new Date(tard); demain.setDate(demain.getDate() + 1)
    await db.recolteArbre.update({ where: { id: r.id }, data: { date: tard } })
    await db.productionBois.update({ where: { id: b.id }, data: { date: tard } })
    let catalogue = await chargerCatalogueStock(auth.id)
    expect(catalogue.some(a => a.type === 'fruit' && a.id === String(r.id))).toBe(true)
    expect(catalogue.some(a => a.type === 'bois' && a.id === String(b.id))).toBe(true)
    await db.recolteArbre.update({ where: { id: r.id }, data: { date: demain } })
    catalogue = await chargerCatalogueStock(auth.id)
    expect(catalogue.some(a => a.type === 'fruit' && a.id === String(r.id))).toBe(false)
  })
})
