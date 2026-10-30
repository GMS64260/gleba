import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'

const auth = vi.hoisted(() => ({ id: '' }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: async () => ({ error: null,
  session: { user: { id: auth.id, acteurId: auth.id, peutEcrireExploitation: true, estProprietaireExploitation: true } },
}) }))

import db from '@/lib/prisma'
import { DELETE as supprimerArbre } from '@/app/api/arbres/[id]/route'
import { POST as recolter, GET as listerRecoltes } from '@/app/api/arbres/recoltes/route'
import { PATCH as vendreFruit } from '@/app/api/arbres/recoltes/[id]/route'
import { POST as produireBois } from '@/app/api/arbres/bois/route'
import { PATCH as vendreBois } from '@/app/api/arbres/bois/[id]/route'
import { createDepenseFromOperationArbre } from '@/lib/auto-compta'
import { enregistrerReglement, lireReglements } from '@/lib/comptabilite/reglements'
import { nouveauReglementSchema } from '@/lib/validations/reglements'
import { GET as fec } from '@/app/api/comptabilite/export/fec/route'
import { chargerCatalogueStock } from '@/lib/commercial/catalogue-stock'
import { creerDocument, agirSurDocument, facturerDocuments } from '@/lib/commercial/service'
import { contenuDocumentSchema } from '@/lib/commercial/regles'
import { chargerSuiviCommercialVerger } from '@/lib/verger/suivi-commercial'
import { getKpiCompta } from '@/lib/kpi/compta'
import { invalidateKpi } from '@/lib/kpi/cache'

const maintenant = new Date('2026-10-28T12:00:00Z')
const hier = new Date('2026-10-27T12:00:00Z')
const jour = '2026-10-28'
let arbreId: number
let clientId: number
const req = (url: string, method: string, body?: object) => new NextRequest('http://localhost' + url, {
  method, ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
})
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const fruit = (data: object = {}) => db.recolteArbre.create({ data: {
  userId: auth.id, arbreId, date: hier, quantite: 10, prixKg: 2, ...data,
} })
const vendre = (id: number, data: object = {}) => vendreFruit(req('/api/arbres/recoltes/' + id, 'PATCH', {
  statut: 'vendu', prixTotal: 20, prixKg: 2, dateVente: maintenant.toISOString(), ...data,
}), params(id))

async function livrer(nature: 'fruit' | 'bois', id: number, quantite: number, unite: string, prixUnitaire: number, tauxTVA = 0) {
  const contenu = contenuDocumentSchema.parse({ type: 'livraison', clientId, date: jour,
    dateValidite: null, dateLivraison: null, objet: 'Livraison de contrôle',
    lignes: [{ description: 'Lot fictif', quantite, unite, prixUnitaire, tauxTVA,
      articleStockType: nature, articleStockId: String(id) }],
  })
  const document = await creerDocument(auth.id, randomUUID(), contenu)
  await agirSurDocument(auth.id, document.id, 'emettre')
  await agirSurDocument(auth.id, document.id, 'livrer', jour)
  return document
}

describe.skipIf(!process.env.GLEBA_VERGER_QA_DATABASE_URL)('Contre-vérification des six points du verger sur PostgreSQL', () => {
  beforeAll(() => {
    const url = process.env.DATABASE_URL || ''
    if (url !== process.env.GLEBA_VERGER_QA_DATABASE_URL || !/^\/gleba_verger_qa_corrige_20261028_[0-9a-f]{8}$/.test(new URL(url).pathname)) {
      throw new Error('Base PostgreSQL QA vide dédiée obligatoire')
    }
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(maintenant)
  })
  beforeEach(async () => {
    const user = await db.user.create({ data: { email: 'qa-verger-' + randomUUID() + '@example.org', emailVerified: true } })
    auth.id = user.id
    await db.exploitation.create({ data: { userId: auth.id, raisonSociale: 'Ferme fictive', formeJuridique: 'EI',
      regimeFiscal: 'micro-BA', regimeTva: 'reel-normal', emailContact: 'qa@example.org',
      adresseSiege: '1 voie fictive', codePostal: '64000', ville: 'Essai' } })
    const arbre = await db.arbre.create({ data: { userId: auth.id, nom: 'Pommier fictif',
      type: 'fruitier', espece: 'Pommier', posX: 0, posY: 0 } })
    arbreId = arbre.id
    const client = await db.client.create({ data: { userId: auth.id, nom: 'Client fictif' } })
    clientId = client.id
  })
  afterAll(async () => { vi.useRealTimers(); await db.$disconnect() })

  it('conserve le CA et le pointage ancien lorsqu’une suppression d’arbre est refusée', async () => {
    const lot = await fruit()
    expect((await vendre(lot.id)).status).toBe(200)
    await db.venteManuelle.updateMany({ where: { userId: auth.id }, data: { paye: true, modeReglement: 'Chèque' } })
    const avant = await getKpiCompta(auth.id, 2026)
    const res = await supprimerArbre(req('/api/arbres/' + arbreId, 'DELETE'), params(arbreId))
    expect(res.status).toBe(409)
    expect(await db.recolteArbre.findUnique({ where: { id: lot.id } })).not.toBeNull()
    expect(await db.venteManuelle.findFirst({ where: { userId: auth.id, sourceType: 'recolte_arbre', sourceId: lot.id } })).toMatchObject({ montant: 20, paye: true, modeReglement: 'Chèque' })
    expect((await getKpiCompta(auth.id, 2026)).revenusYtd).toBe(avant.revenusYtd)
    expect(await db.reglement.count({ where: { userId: auth.id } })).toBe(0)
  })

  it('permet toujours de supprimer une fiche qui ne porte que du calendrier automatique non réalisé', async () => {
    await db.operationArbre.create({ data: { userId: auth.id, arbreId, type: 'taille', fait: false,
      date: new Date('2027-02-01T12:00:00Z'), datePrevue: new Date('2027-02-01T12:00:00Z'), notes: 'auto:calendrier' } })
    expect((await supprimerArbre(req('/api/arbres/' + arbreId, 'DELETE'), params(arbreId))).status).toBe(200)
    expect(await db.arbre.findUnique({ where: { id: arbreId } })).toBeNull()
  })

  it('sérialise une première récolte et la suppression simultanée de son arbre', async () => {
    const [recolte, suppression] = await Promise.all([
      recolter(req('/api/arbres/recoltes', 'POST', { arbreId, date: jour, quantite: 3 })),
      supprimerArbre(req('/api/arbres/' + arbreId, 'DELETE'), params(arbreId)),
    ])
    expect([[201, 409], [404, 200]]).toContainEqual([recolte.status, suppression.status])
    const arbre = await db.arbre.findUnique({ where: { id: arbreId } })
    expect(await db.recolteArbre.count({ where: { userId: auth.id } })).toBe(arbre ? 1 : 0)
  })

  it('conserve un versement partiel de dépense à la correction et refuse une baisse sous le montant payé', async () => {
    const operation = await db.operationArbre.create({ data: { userId: auth.id, arbreId, type: 'greffe', fait: true, cout: 100, date: hier } })
    const miroir = await createDepenseFromOperationArbre(auth.id, operation)
    expect(miroir).toMatchObject({ montant: 100, paye: true })
    await enregistrerReglement(auth.id, auth.id, nouveauReglementSchema.parse({ type: 'DepenseManuelle', id: miroir!.id,
      montant: 40, date: maintenant, modeReglement: 'Virement', cleIdempotence: randomUUID() }))
    const corrigee = await createDepenseFromOperationArbre(auth.id, { ...operation, description: 'Libellé corrigé' })
    expect(corrigee).toMatchObject({ montant: 100, paye: false })
    expect(await lireReglements(auth.id, { type: 'DepenseManuelle', id: corrigee!.id })).toMatchObject({ montantRegle: 40, resteAPayer: 60 })
    await expect(db.$transaction(async tx => {
      await tx.operationArbre.update({ where: { id: operation.id }, data: { cout: 30 } })
      await createDepenseFromOperationArbre(auth.id, { ...operation, cout: 30 }, tx)
    })).rejects.toThrow(/règlements|remboursement/i)
    expect((await db.operationArbre.findUniqueOrThrow({ where: { id: operation.id } })).cout).toBe(100)
    await db.exploitation.update({ where: { userId: auth.id }, data: { siren: '000000000' } })
    const res = await fec(req('/api/comptabilite/export/fec?exercice=2026', 'GET'))
    const contenu = await res.text()
    expect(res.status, contenu).toBe(200)
    const [entete, ...lignes] = contenu.trim().split('\n').map(l => l.split('\t'))
    const compte = entete.indexOf('CompteNum'), debit = entete.indexOf('Debit'), credit = entete.indexOf('Credit')
    const valeur = (s: string) => Number(s.replace(',', '.'))
    const solde = (prefixe: string) => lignes.filter(l => l[compte]?.startsWith(prefixe)).reduce((s, l) => s + valeur(l[credit]) - valeur(l[debit]), 0)
    expect(solde('401')).toBeCloseTo(60, 2)
    expect(solde('512')).toBeCloseTo(40, 2)
  })

  it('permet une vente historique antérieure à la péremption, mais refuse une vente antérieure à la récolte', async () => {
    const lot = await fruit({ date: new Date('2026-10-20T12:00:00Z'), datePeremption: new Date('2026-10-22T12:00:00Z') })
    expect((await chargerCatalogueStock(auth.id)).some(a => a.type === 'fruit' && a.id === String(lot.id))).toBe(false)
    expect((await vendre(lot.id, { dateVente: '2026-10-19' })).status).toBe(409)
    expect((await vendre(lot.id, { dateVente: '2026-10-21' })).status).toBe(200)
    expect((await db.venteManuelle.findFirstOrThrow({ where: { userId: auth.id, sourceId: lot.id, sourceType: 'recolte_arbre' } })).date.toISOString()).toContain('2026-10-21')
  })

  it('alloue des numéros distincts aux créations concurrentes fruits et bois de même origine', async () => {
    const resultats = await Promise.all([
      recolter(req('/api/arbres/recoltes', 'POST', { arbreId, date: jour, quantite: 3 })),
      produireBois(req('/api/arbres/bois', 'POST', { arbreId, date: jour, type: 'branchage', volumeStere: 1 })),
      recolter(req('/api/arbres/recoltes', 'POST', { arbreId, date: jour, quantite: 4 })),
    ])
    expect(resultats.map(r => r.status)).toEqual([201, 201, 201])
    const lots = await Promise.all(resultats.map(r => r.json()))
    expect(new Set(lots.map(l => l.numLot)).size).toBe(3)
    expect(lots.map(l => l.numLot).sort()).toEqual(['20261028-NA-Pommier-01', '20261028-NA-Pommier-02', '20261028-NA-Pommier-03'])
  })

  it('utilise le même taux bois en vente native et BL sans réécrire un taux choisi explicitement', async () => {
    const bois = async () => db.productionBois.create({ data: { userId: auth.id, arbreId, date: hier,
      type: 'branchage', volumeM3: 0.6, volumeStere: 1, prixVente: 110 } })
    const natif = await bois(), commercial = await bois(), ancien = await bois()
    expect((await vendreBois(req('/api/arbres/bois/' + natif.id, 'PATCH', { statut: 'vendu', prixVente: 110, creerFacture: true }), params(natif.id))).status).toBe(200)
    const article = (await chargerCatalogueStock(auth.id)).find(a => a.type === 'bois' && a.id === String(commercial.id))!
    const bl = await livrer('bois', commercial.id, 1, article.unite, 100, article.tauxTVA)
    const factureBl = await facturerDocuments(auth.id, [bl.id], jour)
    const source = await db.productionBois.findUniqueOrThrow({ where: { id: natif.id } })
    const factureNative = await db.facture.findUniqueOrThrow({ where: { id: source.factureId! }, include: { lignes: true } })
    expect(article.tauxTVA).toBe(10)
    for (const facture of [factureNative, factureBl]) {
      expect(facture.totalHT).toBeCloseTo(100, 2)
      expect(facture.totalTVA).toBeCloseTo(10, 2)
      expect(facture.totalTTC).toBe(110)
    }
    const blAncien = await livrer('bois', ancien.id, 1, article.unite, 100, 20)
    const factureAncienne = await facturerDocuments(auth.id, [blAncien.id], jour)
    expect(factureAncienne).toMatchObject({ totalHT: 100, totalTVA: 20, totalTTC: 120 })
    expect(factureAncienne.lignes[0].tauxTVA).toBe(20)
  })

  it('rattache deux BL à une recette unique et distingue retour physique et avoir', async () => {
    const lot = await fruit()
    const bl1 = await livrer('fruit', lot.id, 4, 'kg', 3), bl2 = await livrer('fruit', lot.id, 3, 'kg', 3)
    const facture = await facturerDocuments(auth.id, [bl1.id, bl2.id], jour)
    const suivi = async () => (await chargerSuiviCommercialVerger(auth.id, 'fruit', [lot.id])).get(lot.id)!
    expect(await suivi()).toHaveLength(1)
    expect((await suivi())[0]).toMatchObject({ quantiteLivree: 7, quantiteRetournee: 0, quantiteNette: 7, revenuTTC: 21 })
    await agirSurDocument(auth.id, bl1.id, 'retourner')
    expect((await suivi())[0]).toMatchObject({ quantiteLivree: 7, quantiteRetournee: 4, quantiteNette: 3, revenuTTC: 21 })
    expect((await db.recolteArbre.findUniqueOrThrow({ where: { id: lot.id } })).stockDisponibleCommercial).toBe(7)
    await db.facture.create({ data: { userId: auth.id, numero: 'A-QA-' + randomUUID(), type: 'avoir',
      factureOrigineId: facture.id, clientNom: 'Client fictif', date: maintenant, statut: 'emise',
      totalHT: 12, totalTVA: 0, totalTTC: 12,
      lignes: { create: { description: 'Retour du premier BL', quantite: 4, unite: 'kg', prixUnitaire: 3, tauxTVA: 0,
        montantHT: 12, montantTVA: 0, montantTTC: 12, articleStockType: 'fruit', articleStockId: String(lot.id) } } } })
    expect((await suivi())[0]).toMatchObject({ quantiteNette: 3, revenuTTC: 9, montantAvoirs: 12 })
    invalidateKpi(auth.id)
    expect((await getKpiCompta(auth.id, 2026)).revenusYtd).toBe(9)
    expect((await chargerCatalogueStock(auth.id)).find(a => a.type === 'fruit' && a.id === String(lot.id))?.disponible).toBe(7)
    const response = await listerRecoltes(req('/api/arbres/recoltes', 'GET'))
    expect(response.status).toBe(200)
    const lignes = await response.json() as Array<{ id: number; stockDisponibleCommercial: number; ventesCommerciales: Array<{ revenuTTC: number; quantiteNette: number }> }>
    expect(lignes.find(l => l.id === lot.id)).toMatchObject({ stockDisponibleCommercial: 7,
      ventesCommerciales: [expect.objectContaining({ revenuTTC: 9, quantiteNette: 3 })] })
    expect(await chargerSuiviCommercialVerger('exploitation-fictive-absente', 'fruit', [lot.id])).toEqual(new Map())
  })
})
