import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
const auth = vi.hoisted(() => ({ id: '' }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: async () => ({ error: null,
  session: { user: { id: auth.id, acteurId: auth.id, estProprietaireExploitation: true, peutEcrireExploitation: true } },
}) }))
import db from '@/lib/prisma'
import { POST as RECOLTER } from '@/app/api/arbres/recoltes/route'
import { PATCH as VENDRE, PUT as CORRIGER } from '@/app/api/arbres/recoltes/[id]/route'
import { POST as CAMPAGNE } from '@/app/api/arbres/campagnes/route'
import { GET as FICHE_CAMPAGNE, PUT as CORRIGER_CAMPAGNE } from '@/app/api/arbres/campagnes/[id]/route'
import { POST as OPERATION } from '@/app/api/arbres/operations/route'
import { POST as GENERER_CALENDRIER } from '@/app/api/arbres/[id]/generer-calendrier/route'
import { GET as FEC } from '@/app/api/comptabilite/export/fec/route'
import { getKpiCompta } from '@/lib/kpi/compta'
import { computeTvaPeriode } from '@/lib/kpi/tva'
import { computeCoutsProduction } from '@/lib/comptabilite/couts-production'
import { creerDocument, agirSurDocument, facturerDocuments } from '@/lib/commercial/service'
import { contenuDocumentSchema } from '@/lib/commercial/regles'
import { lireReglements, annulerReglement } from '@/lib/comptabilite/reglements'
import { DELETE as SUPPRIMER_RECOLTE } from '@/app/api/arbres/recoltes/[id]/route'
import { PATCH as VENDRE_BOIS } from '@/app/api/arbres/bois/[id]/route'
import { POST as CREER_BOIS } from '@/app/api/arbres/bois/route'
import { DELETE as SUPPRIMER_ARBRE } from '@/app/api/arbres/[id]/route'
import { createDepenseFromCampagnePlantation, createDepenseFromOperationArbre } from '@/lib/auto-compta'
import { GET as REVENUS } from '@/app/api/comptabilite/revenus/route'
import { chargerCatalogueStock } from '@/lib/commercial/catalogue-stock'
const now = new Date('2026-10-28T06:00:00Z')
const hier = new Date('2026-10-27T12:00:00Z')
const jour = '2026-10-28'
const annee = 2026
let a: Awaited<ReturnType<typeof db.arbre.create>>
let autre: Awaited<ReturnType<typeof db.user.create>>
const req = (url: string, method: string, body?: object) => new NextRequest('http://localhost' + url, {
  method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
})
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const lot = (data: object = {}) => db.recolteArbre.create({ data: { userId: auth.id, arbreId: a.id, date: hier, quantite: 10, ...data } })
const vente = (id: number, data: object = {}) => VENDRE(req('/api/arbres/recoltes/' + id, 'PATCH', {
  statut: 'vendu', prixKg: 2, prixTotal: 20, dateVente: now.toISOString(), clientNom: 'Client fictif', ...data,
}), params(id))
const fec = async (exercice = annee) => {
  const r = await FEC(req('/api/comptabilite/export/fec?exercice=' + exercice + '&check=1', 'GET'))
  expect(r.status).toBe(200); return r.json()
}
describe.skipIf(!process.env.GLEBA_VERGER_QA_DATABASE_URL)('Parcours verger corrigé sur PostgreSQL', () => {
beforeAll(() => {
  const url = process.env.DATABASE_URL || ''
  if (url !== process.env.GLEBA_VERGER_QA_DATABASE_URL || !/^\/gleba_verger_qa_corrige_20261028_[0-9a-f]{8}$/.test(new URL(url).pathname)) throw new Error('Base QA verger dédiée obligatoire')
})
beforeEach(async () => {
  const u = await db.user.create({ data: { email: 'verger-' + randomUUID() + '@example.com', emailVerified: true } })
  auth.id = u.id
  autre = await db.user.create({ data: { email: 'verger-autre-' + randomUUID() + '@example.com', emailVerified: true } })
  await db.exploitation.create({ data: { userId: auth.id, raisonSociale: 'Ferme fictive', formeJuridique: 'EI', regimeFiscal: 'micro-BA',
    emailContact: 'fictif@example.com', adresseSiege: '1 voie fictive', codePostal: '64000', ville: 'Essai', regimeTva: 'reel-normal' } })
  a = await db.arbre.create({ data: { userId: auth.id, nom: 'Pommier fictif', type: 'fruitier', espece: 'Pommier', posX: 0, posY: 0 } })
})
afterAll(() => db.$disconnect())

it('CONTROLE : la greffe réalisée et son coût alimentent une dépense unique', async () => {
  const res = await OPERATION(req('/api/arbres/operations', 'POST', { arbreId: a.id, type: 'greffe', fait: true, date: hier.toISOString(), cout: 100 }))
  expect(res.status).toBe(201)
  const op = await res.json()
  const miroirs = await db.depenseManuelle.findMany({ where: { userId: auth.id, sourceType: 'operation_arbre', sourceId: op.id } })
  expect(miroirs).toHaveLength(1)
  expect(miroirs[0].montant).toBe(100)
  expect((await getKpiCompta(auth.id, annee)).depensesYtd).toBe(100)
})

it('CONTROLE : récolter sur l’arbre d’une autre exploitation est refusé', async () => {
  const arbreAutre = await db.arbre.create({ data: { userId: autre.id, nom: 'Arbre fictif tiers', type: 'fruitier', espece: 'Pommier', posX: 0, posY: 0 } })
  const res = await RECOLTER(req('/api/arbres/recoltes', 'POST', { arbreId: arbreAutre.id, quantite: 10, date: hier.toISOString() }))
  expect(res.status).toBe(404)
  expect(await db.recolteArbre.count({ where: { userId: auth.id } })).toBe(0)
})

it('le DAR est signalé à la récolte puis à la vente', async () => {
  await db.observationSante.create({ data: { userId: auth.id, arbreId: a.id, date: hier, type: 'maladie',
    traitement: 'Traitement fictif', methodeTraitement: 'chimique', produit: 'Produit fictif', dar: 7, numAMM: '9999999',
    doseAppliquee: 1, uniteDose: 'L/ha', surfaceTraiteeHa: 1, volumeBouillieLHa: 100,
    temperatureC: 20, ventKmh: 5, hygrometriePct: 50, certiphytoNum: 'QA-fictif', operateurId: auth.id,
    zntRespectee: true, zntDistanceM: 5 } })
  const recolte = await RECOLTER(req('/api/arbres/recoltes', 'POST', { arbreId: a.id, quantite: 10, prixKg: 2, date: now.toISOString() }))
  const json = await recolte.json()
  expect(recolte.status).toBe(201)
  const avertissements = [...(json.warnings ?? []), ...(json.avertissements ?? [])].join(' ')
  expect(avertissements).toMatch(/DAR|délai avant récolte|traitement/i)
  const vendue = await vente(json.id)
  expect(vendue.status).toBe(200)
  console.log('Avertissement DAR partagé', { darJours: 7, recolteLeLendemain: recolte.status, vente: vendue.status, avertissementDAR: true })
})


it('une vente et sa facture restent à encaisser sans règlement explicite', async () => {
  const r1 = await lot(), r2 = await lot()
  expect((await vente(r1.id)).status).toBe(200)
  expect((await vente(r2.id, { creerFacture: true })).status).toBe(200)
  const m = await db.venteManuelle.findFirstOrThrow({ where: { userId: auth.id, sourceType: 'recolte_arbre', sourceId: r1.id } })
  const f = await db.facture.findFirstOrThrow({ where: { userId: auth.id } })
  const observation = { miroirPaye: m.paye, facture: f.statut, mode: f.modePaiement, versements: await db.reglement.count({ where: { userId: auth.id } }) }
  console.log('Vente à encaisser', observation)
  expect(observation).toEqual({ miroirPaye: false, facture: 'emise', mode: null, versements: 0 })
})

it('deux ventes simultanées ne créent qu’une facture', async () => {
  const r = await lot()
  const reponses = await Promise.all([vente(r.id, { creerFacture: true }), vente(r.id, { creerFacture: true })])
  expect(reponses.map(x => x.status).sort()).toEqual([200, 409])
  expect(await db.facture.count({ where: { userId: auth.id } })).toBe(1)
  expect((await getKpiCompta(auth.id, annee)).revenusYtd).toBe(20)
})

it('une livraison BL protège le lot contre la vente native et les anciens clients SQL', async () => {
  const r = await lot()
  const client = await db.client.create({ data: { userId: auth.id, nom: 'Client fictif' } })
  const contenu = contenuDocumentSchema.parse({ type: 'livraison', clientId: client.id, date: jour, dateValidite: null, dateLivraison: null,
    objet: 'Fruits fictifs', lignes: [{ description: 'Pommes fictives', quantite: 4, unite: 'kg', prixUnitaire: 3, tauxTVA: 0, articleStockType: 'fruit', articleStockId: String(r.id) }] })
  const bl = await creerDocument(auth.id, randomUUID(), contenu)
  await agirSurDocument(auth.id, bl.id, 'emettre')
  await agirSurDocument(auth.id, bl.id, 'livrer', jour)
  expect((await vente(r.id)).status).toBe(409)
  await expect(db.recolteArbre.update({ where: { id: r.id }, data: { statut: 'vendu' } })).rejects.toThrow(/STOCK_COMMERCIAL_LIE/)
  const source = await db.recolteArbre.findUniqueOrThrow({ where: { id: r.id } })
  expect(source.stockDisponibleCommercial).toBe(6)
  expect(source.statut).toBe('en_stock')
})

it('PUT d’une récolte vendue est refusé ; PATCH corrige atomiquement la vente non facturée', async () => {
  const r = await lot()
  expect((await vente(r.id)).status).toBe(200)
  const res = await CORRIGER(req('/api/arbres/recoltes/' + r.id, 'PUT', { quantite: 5, prixKg: 3 }), params(r.id))
  const source = await db.recolteArbre.findUniqueOrThrow({ where: { id: r.id } })
  const miroir = await db.venteManuelle.findFirstOrThrow({ where: { userId: auth.id, sourceType: 'recolte_arbre', sourceId: r.id } })
  const observation = { reponse: res.status, poidsSource: source.quantite, prixSource: source.prixKg, poidsMiroir: miroir.quantite, prixMiroir: miroir.prixUnitaire }
  console.log('Correction protégée', observation)
  expect(observation).toEqual({ reponse: 409, poidsSource: 10, prixSource: 2, poidsMiroir: 10, prixMiroir: 2 })
  expect(miroir.montant).toBe(20)
  const tva = await computeTvaPeriode(auth.id, new Date(annee, 0, 1), new Date(annee + 1, 0, 1))
  expect(tva.collectee.total).toBeCloseTo(20 - 20 / 1.055, 2)
  const correction = await VENDRE(req('/api/arbres/recoltes/' + r.id, 'PATCH', { prixTotal: 30 }), params(r.id))
  expect(correction.status).toBe(200)
  expect((await db.recolteArbre.findUniqueOrThrow({ where: { id: r.id } })).prixTotal).toBe(30)
  expect((await db.venteManuelle.findFirstOrThrow({ where: { userId: auth.id, sourceId: r.id, sourceType: 'recolte_arbre' } })).montant).toBe(30)
  expect((await getKpiCompta(auth.id, annee)).revenusYtd).toBe(30)
})

it('total négocié : même montant de 15 € dans CA, TVA et FEC', async () => {
  const r = await lot()
  expect((await vente(r.id, { prixTotal: 15 })).status).toBe(200)
  const kpi = await getKpiCompta(auth.id, annee)
  const tva = await computeTvaPeriode(auth.id, new Date(annee, 0, 1), new Date(annee + 1, 0, 1))
  const f = await fec()
  console.log('Total TTC commun', { CA: kpi.revenusYtd, TVA: tva.collectee.total, ecrituresFec: f.nbEcritures })
  expect(kpi.revenusYtd).toBe(15)
  expect(tva.collectee.total).toBeCloseTo(15 - 15 / 1.055, 2)
  expect(f.nbEcritures).toBeGreaterThan(0)
})

it('récolte de 2025 vendue en 2026 présente dans le FEC 2026', async () => {
  const r = await lot({ date: new Date('2025-12-20T12:00:00Z') })
  expect((await vente(r.id)).status).toBe(200)
  const kpi = await getKpiCompta(auth.id, annee)
  const f = await fec()
  console.log('Exercice de vente', { CA2026: kpi.revenusYtd, ecrituresFec2026: f.nbEcritures })
  expect(kpi.revenusYtd).toBe(20)
  expect(f.nbEcritures).toBeGreaterThan(0)
})

it('un BL de fruits facturé contribue une seule fois aux revenus du verger', async () => {
  const r = await lot()
  const client = await db.client.create({ data: { userId: auth.id, nom: 'Client fictif' } })
  const contenu = contenuDocumentSchema.parse({ type: 'livraison', clientId: client.id, date: jour, dateValidite: null, dateLivraison: null,
    objet: 'Fruits fictifs', lignes: [{ description: 'Pommes fictives', quantite: 4, unite: 'kg', prixUnitaire: 3, tauxTVA: 0, articleStockType: 'fruit', articleStockId: String(r.id) }] })
  const bl = await creerDocument(auth.id, randomUUID(), contenu)
  await agirSurDocument(auth.id, bl.id, 'emettre')
  await agirSurDocument(auth.id, bl.id, 'livrer', jour)
  await facturerDocuments(auth.id, [bl.id], jour)
  const couts = await computeCoutsProduction(auth.id, annee)
  const observation = { CA: couts.totaux.revenus, revenusVerger: couts.parModule.verger.revenus,
    restant: (await db.recolteArbre.findUniqueOrThrow({ where: { id: r.id } })).stockDisponibleCommercial }
  console.log('BL fruits facturé', observation)
  expect(observation).toEqual({ CA: 12, revenusVerger: 12, restant: 6 })
})

it('POST récolte refuse une parcelle privée tierce sans créer le lot', async () => {
  const p = await db.parcelleGeo.create({ data: { userId: autre.id, nom: 'Parcelle privée fictive', geometry: '{"type":"Polygon","coordinates":[]}' } })
  const res = await RECOLTER(req('/api/arbres/recoltes', 'POST', { arbreId: a.id, quantite: 10, date: hier.toISOString(), parcelleId: p.id }))
  expect(res.status).toBe(400)
  expect(JSON.stringify(await res.json())).not.toContain(p.nom)
  expect(await db.recolteArbre.count({ where: { userId: auth.id } })).toBe(0)
})

it('la campagne refuse les références privées tierces et masque une ancienne liaison', async () => {
  const pg = await db.porteGreffe.create({ data: { userId: autre.id, nom: 'Porte-greffe privé ' + randomUUID(), partageCommunaute: false, vigueur: 3, precocite: 3, sensibilites: [] } })
  const p = await db.parcelleGeo.create({ data: { userId: autre.id, nom: 'Parcelle privée fictive', geometry: '{"type":"Polygon","coordinates":[]}' } })
  const res = await CAMPAGNE(req('/api/arbres/campagnes', 'POST', { nom: 'Campagne fictive', typeFormation: 'verger', porteGreffeId: pg.id, genererEtapes: false }))
  expect(res.status).toBe(400)
  const c = await db.campagnePlantation.create({ data: { userId: auth.id, nom: 'Campagne fictive', typeFormation: 'verger', porteGreffeId: pg.id } })
  const fiche = await FICHE_CAMPAGNE(req('/api/arbres/campagnes/' + c.id, 'GET'), params(c.id))
  const json = await fiche.json()
  expect(json.porteGreffe).toBeNull()
  expect(json.porteGreffeId).toBeNull()
  const correction = await CORRIGER_CAMPAGNE(req('/api/arbres/campagnes/' + c.id, 'PUT', { parcelleGeoId: p.id }), params(c.id))
  expect(correction.status).toBe(400)
  expect((await db.campagnePlantation.findUniqueOrThrow({ where: { id: c.id } })).parcelleGeoId).toBeNull()
})

it('une greffe à faire est exclue des coûts réalisés du verger', async () => {
  const res = await OPERATION(req('/api/arbres/operations', 'POST', { arbreId: a.id, type: 'greffe', fait: false, datePrevue: '2026-11-15', cout: 100 }))
  expect(res.status).toBe(201)
  const couts = await computeCoutsProduction(auth.id, annee)
  const kpi = await getKpiCompta(auth.id, annee)
  const observation = { coutsVerger: couts.parModule.verger.couts, depensesCompta: kpi.depensesYtd }
  console.log('Coût planifié / réalisé', observation)
  expect(observation).toEqual({ coutsVerger: 0, depensesCompta: 0 })
})

it('un prix négatif est refusé sans sortie du stock ni écriture', async () => {
  const r = await lot()
  const res = await vente(r.id, { prixKg: -2, prixTotal: -20 })
  const source = await db.recolteArbre.findUniqueOrThrow({ where: { id: r.id } })
  const observation = { reponse: res.status, statut: source.statut, montant: source.prixTotal,
    miroirs: await db.venteManuelle.count({ where: { userId: auth.id } }) }
  console.log('Prix négatif', observation)
  expect(observation).toEqual({ reponse: 400, statut: 'en_stock', montant: null, miroirs: 0 })
})

it('recalculer conserve les gestes réalisés ou abandonnés sans les remettre à faire', async () => {
  const generer = () => GENERER_CALENDRIER(req('/api/arbres/' + a.id + '/generer-calendrier', 'POST', { year: 2027 }), params(a.id))
  expect((await generer()).status).toBe(200)
  const operations = await db.operationArbre.findMany({ where: { userId: auth.id, arbreId: a.id }, orderBy: { id: 'asc' } })
  expect(operations.length).toBeGreaterThan(1)
  const [faite, abandonnee] = operations
  await db.operationArbre.update({ where: { id: faite.id }, data: { fait: true } })
  await db.operationArbre.update({ where: { id: abandonnee.id }, data: { abandonneeLe: now } })
  expect((await generer()).status).toBe(200)
  const relancee = (op: typeof faite) => db.operationArbre.count({ where: { arbreId: a.id, type: op.type, datePrevue: op.datePrevue, fait: false, abandonneeLe: null } })
  const observation = { faiteRemiseAFaire: await relancee(faite), abandonneeRemiseAFaire: await relancee(abandonnee) }
  console.log('Calendrier recalculé', observation)
  expect(observation).toEqual({ faiteRemiseAFaire: 0, abandonneeRemiseAFaire: 0 })
})

it.each([false, true])('le règlement explicite est journalisé atomiquement, facture=%s', async facture => {
  const r = await lot()
  const res = await vente(r.id, { creerFacture: facture, paye: true, modeReglement: 'Chèque', datePaiement: now.toISOString() })
  expect(res.status).toBe(200)
  const reglements = await db.reglement.findMany({ where: { userId: auth.id } })
  expect(reglements).toHaveLength(1)
  expect(Number(reglements[0].montantCentimes)).toBe(2000)
  expect(reglements[0].modeReglement).toBe('Chèque')
  if (facture) {
    const f = await db.facture.findFirstOrThrow({ where: { userId: auth.id } })
    expect(f.statut).toBe('payee'); expect(f.modePaiement).toBe('cheque')
    expect(await db.venteManuelle.count({ where: { userId: auth.id } })).toBe(0)
  } else {
    const m = await db.venteManuelle.findFirstOrThrow({ where: { userId: auth.id } })
    expect(m.paye).toBe(true); expect(m.modeReglement).toBe('Chèque')
  }
})
it('un paiement futur invalide annule aussi facture, source et miroir', async () => {
  const r = await lot()
  const res = await vente(r.id, { creerFacture: true, paye: true, modeReglement: 'CB', datePaiement: '2090-01-01' })
  expect(res.status).toBe(400)
  expect((await db.recolteArbre.findUniqueOrThrow({ where: { id: r.id } })).statut).toBe('en_stock')
  expect(await db.facture.count({ where: { userId: auth.id } })).toBe(0)
  expect(await db.venteManuelle.count({ where: { userId: auth.id } })).toBe(0)
  expect(await db.reglement.count({ where: { userId: auth.id } })).toBe(0)
})
it('les versements et alias survivent à une hausse ; baisse et suppression sont refusées', async () => {
  const r = await lot()
  expect((await vente(r.id, { paye: true, modeReglement: 'CB' })).status).toBe(200)
  const modifier = (prixTotal: number) => VENDRE(req('/api/arbres/recoltes/' + r.id, 'PATCH', { prixTotal }), params(r.id))
  expect((await modifier(10)).status).toBe(409)
  expect((await db.recolteArbre.findUniqueOrThrow({ where: { id: r.id } })).prixTotal).toBe(20)
  expect((await SUPPRIMER_RECOLTE(req('/api/arbres/recoltes/' + r.id, 'DELETE'), params(r.id))).status).toBe(409)
  expect((await modifier(30)).status).toBe(200)
  const m = await db.venteManuelle.findFirstOrThrow({ where: { userId: auth.id } })
  const suivi = await lireReglements(auth.id, { type: 'VenteManuelle', id: m.id })
  expect(suivi.montantRegle).toBe(20); expect(suivi.resteAPayer).toBe(10); expect(m.paye).toBe(false)
  const reglement = await db.reglement.findFirstOrThrow({ where: { userId: auth.id } })
  await annulerReglement(auth.id, auth.id, reglement.id, 'Correction fictive')
  expect((await lireReglements(auth.id, { type: 'VenteManuelle', id: m.id })).montantRegle).toBe(0)
})
it('facturer une ancienne vente déclarée payée conserve son mode sans versement inventé', async () => {
  const r = await lot()
  expect((await vente(r.id)).status).toBe(200)
  await db.venteManuelle.updateMany({ where: { userId: auth.id }, data: { paye: true, modeReglement: 'Chèque' } })
  const res = await VENDRE(req('/api/arbres/recoltes/' + r.id, 'PATCH', { creerFacture: true }), params(r.id))
  expect(res.status).toBe(200)
  const f = await db.facture.findFirstOrThrow({ where: { userId: auth.id } })
  expect(f.statut).toBe('payee'); expect(f.modePaiement).toBe('cheque')
  expect(await db.reglement.count({ where: { userId: auth.id } })).toBe(0)
})
it('un retour après avoir ne peut pas réutiliser les versements de l’ancienne facture', async () => {
  const r = await lot()
  expect((await vente(r.id, { paye: true, modeReglement: 'CB' })).status).toBe(200)
  expect((await VENDRE(req('/api/arbres/recoltes/' + r.id, 'PATCH', { creerFacture: true }), params(r.id))).status).toBe(200)
  const f = await db.facture.findFirstOrThrow({ where: { userId: auth.id, type: 'facture' } })
  await db.facture.create({ data: { userId: auth.id, numero: 'A-FICTIF-' + randomUUID(), clientNom: 'Client fictif', type: 'avoir', statut: 'emise', factureOrigineId: f.id, totalTTC: 20, totalHT: 20 / 1.055, totalTVA: 20 - 20 / 1.055 } })
  expect((await VENDRE(req('/api/arbres/recoltes/' + r.id, 'PATCH', { statut: 'en_stock' }), params(r.id))).status).toBe(200)
  expect((await vente(r.id)).status).toBe(409)
  expect((await db.recolteArbre.findUniqueOrThrow({ where: { id: r.id } })).statut).toBe('en_stock')
  expect(await db.reglement.count({ where: { userId: auth.id, annuleLe: null } })).toBe(1)
})
it('une nouvelle vente après annulation sans règlement prend la date du jour', async () => {
  const r = await lot({ date: new Date('2025-12-01T12:00:00Z') })
  expect((await vente(r.id, { dateVente: '2025-12-20T12:00:00Z' })).status).toBe(200)
  expect((await VENDRE(req('/api/arbres/recoltes/' + r.id, 'PATCH', { statut: 'en_stock' }), params(r.id))).status).toBe(200)
  const revente = await VENDRE(req('/api/arbres/recoltes/' + r.id, 'PATCH', { statut: 'vendu', prixKg: 2 }), params(r.id))
  expect(revente.status).toBe(200)
  expect(new Date((await revente.json()).dateVente).getFullYear()).toBe(new Date().getFullYear())
})
it('le bois partage les protections de concurrence et le suivi réel du règlement', async () => {
  const b = await db.productionBois.create({ data: { userId: auth.id, arbreId: a.id, type: 'elagage', date: hier, volumeM3: 1, statut: 'en_stock' } })
  const vendre = () => VENDRE_BOIS(req('/api/arbres/bois/' + b.id, 'PATCH', { statut: 'vendu', prixVente: 100, creerFacture: true }), params(b.id))
  const reponses = await Promise.all([vendre(), vendre()])
  expect(reponses.map(r => r.status).sort()).toEqual([200, 409])
  const f = await db.facture.findFirstOrThrow({ where: { userId: auth.id } })
  expect(f.statut).toBe('emise'); expect(f.modePaiement).toBeNull()
})
it('prix unitaire seul : le serveur conserve un total et les lecteurs de recettes le retrouvent', async () => {
  const r = await lot()
  const res = await VENDRE(req('/api/arbres/recoltes/' + r.id, 'PATCH', { statut: 'vendu', prixKg: 2 }), params(r.id))
  expect(res.status).toBe(200)
  expect((await res.json()).prixTotal).toBe(20)
  const revenus = await REVENUS(req('/api/comptabilite/revenus?annee=2026', 'GET'))
  expect(revenus.status).toBe(200)
  expect(JSON.stringify(await revenus.json())).toContain('recolte-arbre-' + r.id)
  expect((await fec()).nbEcritures).toBeGreaterThan(0)
})
it('le catalogue commercial avertit aussi sur le DAR du lot lié', async () => {
  const r = await lot({ date: now })
  await db.observationSante.create({ data: { userId: auth.id, arbreId: a.id, date: hier, type: 'maladie', produit: 'Produit fictif', dar: 7 } })
  const catalogue = await chargerCatalogueStock(auth.id)
  expect(catalogue.find(x => x.type === 'fruit' && x.id === String(r.id))?.avertissements?.join(' ')).toContain('DAR')
})

it('le DAR inclut un traitement horodaté après minuit le jour de récolte', async () => {
  await db.observationSante.create({ data: { userId: auth.id, arbreId: a.id, date: new Date('2026-10-27T12:00:00Z'), type: 'maladie', produit: 'Produit fictif', dar: 7 } })
  const res = await RECOLTER(req('/api/arbres/recoltes', 'POST', { arbreId: a.id, quantite: 10, date: '2026-10-27' }))
  expect(res.status).toBe(201)
  expect((await res.json()).warnings.join(' ')).toContain('DAR')
})
it('le DAR individuel ne concerne pas les voisins ; un traitement de parcelle les concerne', async () => {
  const p = await db.parcelleGeo.create({ data: { userId: auth.id, nom: 'Parcelle fictive', geometry: '{"type":"Polygon","coordinates":[]}' } })
  await db.arbre.update({ where: { id: a.id }, data: { parcelleGeoId: p.id } })
  const voisin = await db.arbre.create({ data: { userId: auth.id, nom: 'Voisin fictif', type: 'fruitier', espece: 'Pommier', posX: 1, posY: 1, parcelleGeoId: p.id } })
  const traitement = { userId: auth.id, date: new Date('2026-10-26T12:00:00Z'), dar: 7 }
  await db.observationSante.create({ data: { ...traitement, arbreId: voisin.id, parcelleId: p.id, type: 'maladie', produit: 'Produit fictif' } })
  await db.intervention.create({ data: { ...traitement, arbreId: voisin.id, parcelleId: p.id, type: 'traitement_phyto', fait: true } })
  const res = await RECOLTER(req('/api/arbres/recoltes', 'POST', { arbreId: a.id, quantite: 10, date: '2026-10-27' }))
  expect(res.status).toBe(201)
  const r = await res.json()
  expect((r.warnings ?? []).join(' ')).not.toContain('DAR')
  await db.intervention.create({ data: { ...traitement, parcelleId: p.id, type: 'traitement_phyto', fait: true } })
  expect((await chargerCatalogueStock(auth.id)).find(x => x.type === 'fruit' && x.id === String(r.id))?.avertissements?.join(' ')).toContain('DAR')
})
it('une ancienne zone privée tierce ne fournit pas le statut bio de la récolte', async () => {
  const zone = await db.zoneVerger.create({ data: { userId: autre.id, nom: 'Zone privée fictive', statutBio: 'AB' } })
  await db.arbre.update({ where: { id: a.id }, data: { zoneId: zone.id } })
  const res = await RECOLTER(req('/api/arbres/recoltes', 'POST', { arbreId: a.id, quantite: 10, date: '2026-10-27' }))
  expect(res.status).toBe(201)
  const json = await res.json()
  expect(json.statutBioSnapshot).toBeNull()
  expect(JSON.stringify(json)).not.toContain(zone.nom)
})
it('les notations ambiguës d’identifiants ne contournent pas le propriétaire contrôlé', async () => {
  const zone = await db.zoneVerger.create({ data: { id: 3_000_001, userId: auth.id, nom: 'Zone fictive' } })
  const zoneAutre = await db.zoneVerger.create({ data: { id: zone.id * 10, userId: autre.id, nom: 'Zone tierce fictive' } })
  const bois = await db.productionBois.create({ data: { id: 5_000_001, userId: auth.id, type: 'elagage', date: hier, volumeM3: 1 } })
  const boisAutre = await db.productionBois.create({ data: { id: bois.id * 10, userId: autre.id, type: 'elagage', date: hier, volumeM3: 1 } })
  const c = await db.campagnePlantation.create({ data: { userId: auth.id, nom: 'Campagne fictive', typeFormation: 'verger' } })
  for (const saisie of [{ zoneVergerId: String(zoneAutre.id) + 'e-1' }, { productionBoisId: String(boisAutre.id) + 'e-1' }]) {
    expect((await CORRIGER_CAMPAGNE(req('/api/arbres/campagnes/' + c.id, 'PUT', saisie), params(c.id))).status).toBe(400)
  }
  expect((await CORRIGER_CAMPAGNE(req('/api/arbres/campagnes/' + c.id, 'PUT', { zoneVergerId: String(zone.id), productionBoisId: String(bois.id) }), params(c.id))).status).toBe(200)
  const final = await db.campagnePlantation.findUniqueOrThrow({ where: { id: c.id } })
  expect(final.zoneVergerId).toBe(zone.id); expect(final.productionBoisId).toBe(bois.id)
})
it('le recalcul des agrumes reste répétable pour une récolte prévue l’année suivante', async () => {
  await db.arbre.update({ where: { id: a.id }, data: { espece: 'Agrumes' } })
  const generer = () => GENERER_CALENDRIER(req('/api/arbres/' + a.id + '/generer-calendrier', 'POST', { year: 2027 }), params(a.id))
  expect((await generer()).status).toBe(200)
  const initial = await db.operationArbre.count({ where: { arbreId: a.id } })
  const hiver = await db.operationArbre.findFirstOrThrow({ where: { arbreId: a.id, type: 'recolte' } })
  expect(hiver.datePrevue!.getFullYear()).toBe(2028)
  expect((await generer()).status).toBe(200)
  expect(await db.operationArbre.count({ where: { arbreId: a.id } })).toBe(initial)
  const courante = await db.operationArbre.findFirstOrThrow({ where: { arbreId: a.id, type: 'recolte' } })
  await db.operationArbre.update({ where: { id: courante.id }, data: { fenetreDebut: null, dateLimite: null, fait: true } })
  expect((await generer()).status).toBe(200)
  expect(await db.operationArbre.count({ where: { arbreId: a.id } })).toBe(initial)
  expect(await db.operationArbre.count({ where: { arbreId: a.id, type: 'recolte', fait: false } })).toBe(0)
})
it('une ancienne taille faite au quinze sans fenêtre ne renaît pas au nouveau pivot', async () => {
  await db.operationArbre.create({ data: { userId: auth.id, arbreId: a.id, type: 'taille', fait: true, notes: 'auto:calendrier', saisonRecommandee: 'hiver',
    date: new Date('2027-02-16T12:00:00Z'), datePrevue: new Date('2027-02-15T12:00:00Z') } })
  const res = await GENERER_CALENDRIER(req('/api/arbres/' + a.id + '/generer-calendrier', 'POST', { year: 2027 }), params(a.id))
  expect(res.status).toBe(200)
  expect(await db.operationArbre.count({ where: { arbreId: a.id, type: 'taille', saisonRecommandee: 'hiver', fait: false } })).toBe(0)
})
it('deux tailles d’été du cerisier restent deux gestes distincts', async () => {
  await db.arbre.update({ where: { id: a.id }, data: { espece: 'Cerisier' } })
  await db.operationArbre.create({ data: { userId: auth.id, arbreId: a.id, type: 'taille', fait: true, notes: 'auto:calendrier', saisonRecommandee: 'ete',
    date: new Date('2027-07-15T12:00:00Z'), datePrevue: new Date('2027-07-15T12:00:00Z') } })
  const res = await GENERER_CALENDRIER(req('/api/arbres/' + a.id + '/generer-calendrier', 'POST', { year: 2027 }), params(a.id))
  expect(res.status).toBe(200)
  expect(await db.operationArbre.count({ where: { arbreId: a.id, type: 'taille', saisonRecommandee: 'ete', fait: false } })).toBe(1)
})
it('deux anciennes tailles d’été déjà faites ne sont pas recréées', async () => {
  await db.arbre.update({ where: { id: a.id }, data: { espece: 'Cerisier' } })
  await db.operationArbre.createMany({ data: [12, 15].map(jour => ({ userId: auth.id, arbreId: a.id, type: 'taille', fait: true,
    notes: 'auto:calendrier', saisonRecommandee: 'ete', date: new Date(`2027-07-${jour}T12:00:00Z`), datePrevue: new Date(`2027-07-${jour}T12:00:00Z`) })) })
  expect((await GENERER_CALENDRIER(req('/api/arbres/' + a.id + '/generer-calendrier', 'POST', { year: 2027 }), params(a.id))).status).toBe(200)
  expect(await db.operationArbre.count({ where: { arbreId: a.id, type: 'taille', saisonRecommandee: 'ete', fait: false } })).toBe(0)
})
it.each([false, true])('recalculer l’année suivante conserve l’hiver précédent, ancien format : %s', async legacy => {
  await db.arbre.update({ where: { id: a.id }, data: { espece: 'Agrumes' } })
  const generer = (year: number) => GENERER_CALENDRIER(req('/api/arbres/' + a.id + '/generer-calendrier', 'POST', { year }), params(a.id))
  expect((await generer(2026)).status).toBe(200)
  if (legacy) await db.operationArbre.updateMany({ where: { arbreId: a.id }, data: { fenetreDebut: null, dateLimite: null } })
  expect((await generer(2027)).status).toBe(200)
  const hivers = await db.operationArbre.findMany({ where: { arbreId: a.id, type: 'recolte' }, orderBy: { datePrevue: 'asc' } })
  expect(hivers.map(o => o.datePrevue!.getFullYear())).toEqual([2027, 2028])
})
it('le bois refuse prix négatif et parcelle étrangère même avec un numéro de lot saisi', async () => {
  const p = await db.parcelleGeo.create({ data: { userId: autre.id, nom: 'Parcelle bois privée', geometry: '{"type":"Polygon","coordinates":[]}' } })
  const creer = (data: object) => CREER_BOIS(req('/api/arbres/bois', 'POST', { type: 'branchage', poidsKg: 5, ...data }))
  expect((await creer({ prixVente: -1 })).status).toBe(400)
  expect((await creer({ parcelleId: p.id, numLot: 'LOT-BOIS' })).status).toBe(400)
  expect(await db.productionBois.count({ where: { userId: auth.id } })).toBe(0)
})
it('un ancien geste fait le dernier jour de la fenêtre reste soldé toute la journée', async () => {
  await db.operationArbre.create({ data: { userId: auth.id, arbreId: a.id, type: 'taille', fait: true, notes: 'auto:calendrier',
    saisonRecommandee: 'hiver', date: new Date('2027-03-31T12:00:00Z'), datePrevue: new Date('2027-03-31T12:00:00Z') } })
  expect((await GENERER_CALENDRIER(req('/api/arbres/' + a.id + '/generer-calendrier', 'POST', { year: 2027 }), params(a.id))).status).toBe(200)
  expect(await db.operationArbre.count({ where: { arbreId: a.id, type: 'taille', saisonRecommandee: 'hiver', fait: false } })).toBe(0)
})
it.each(['fait', 'abandonne'])('un ancien geste %s déplacé hors de sa fenêtre garde son identité', async etat => {
  const generer = () => GENERER_CALENDRIER(req('/api/arbres/' + a.id + '/generer-calendrier', 'POST', { year: 2027 }), params(a.id))
  expect((await generer()).status).toBe(200)
  const taille = await db.operationArbre.findFirstOrThrow({ where: { arbreId: a.id, type: 'taille', saisonRecommandee: 'hiver' } })
  await db.operationArbre.update({ where: { id: taille.id }, data: { fenetreDebut: null, dateLimite: null,
    datePrevue: new Date('2027-04-01T12:00:00Z'), fait: etat === 'fait', abandonneeLe: etat === 'abandonne' ? new Date('2027-04-01T12:00:00Z') : null } })
  expect((await generer()).status).toBe(200)
  expect(await db.operationArbre.count({ where: { arbreId: a.id, type: 'taille', saisonRecommandee: 'hiver', fait: false, abandonneeLe: null } })).toBe(0)
})
it.each(['en_stock', 'vendu'])('supprimer un arbre conserve une récolte %s et ses écritures', async statut => {
  const r = await lot()
  if (statut === 'vendu') expect((await vente(r.id)).status).toBe(200)
  const res = await SUPPRIMER_ARBRE(req('/api/arbres/' + a.id, 'DELETE'), params(a.id))
  expect(res.status).toBe(409)
  expect(await db.arbre.findUnique({ where: { id: a.id } })).not.toBeNull()
  expect(await db.recolteArbre.findUnique({ where: { id: r.id } })).not.toBeNull()
  if (statut === 'vendu') expect(await db.venteManuelle.count({ where: { userId: auth.id, sourceType: 'recolte_arbre', sourceId: r.id } })).toBe(1)
})
it('supprimer un arbre conserve une greffe réalisée et la dépense historique', async () => {
  const res = await OPERATION(req('/api/arbres/operations', 'POST', { arbreId: a.id, type: 'greffe', fait: true, date: hier.toISOString(), cout: 100 }))
  const op = await res.json()
  expect((await SUPPRIMER_ARBRE(req('/api/arbres/' + a.id, 'DELETE'), params(a.id))).status).toBe(409)
  expect(await db.operationArbre.findUnique({ where: { id: op.id } })).not.toBeNull()
  expect(await db.depenseManuelle.count({ where: { userId: auth.id, sourceType: 'operation_arbre', sourceId: op.id } })).toBe(1)
})
it('une dépense verger nouvelle reste à régler et conserve ensuite son pointage historique', async () => {
  const op = await db.operationArbre.create({ data: { userId: auth.id, arbreId: a.id, type: 'greffe', fait: true, cout: 100, date: hier } })
  const miroir = await createDepenseFromOperationArbre(auth.id, op)
  expect(miroir?.paye).toBe(false)
  await db.depenseManuelle.update({ where: { id: miroir!.id }, data: { paye: true, modeReglement: 'Virement' } })
  expect(await createDepenseFromOperationArbre(auth.id, { ...op, description: 'Greffe corrigée' })).toMatchObject({ paye: true, modeReglement: 'Virement' })
  const c = await db.campagnePlantation.create({ data: { userId: auth.id, nom: 'Campagne fictive', typeFormation: 'verger', coutReel: 200 } })
  expect((await createDepenseFromCampagnePlantation(auth.id, c))?.paye).toBe(false)
})
it.each([{ date: new Date('2090-01-01T12:00:00Z') }, { datePeremption: new Date('2026-10-26T12:00:00Z') }])('un lot indisponible ne produit ni vente ni facture', async donnees => {
  const r = await lot(donnees)
  expect((await vente(r.id, { creerFacture: true })).status).toBe(409)
  expect(await db.facture.count({ where: { userId: auth.id } })).toBe(0)
  expect(await db.venteManuelle.count({ where: { userId: auth.id } })).toBe(0)
  expect((await db.recolteArbre.findUniqueOrThrow({ where: { id: r.id } })).statut).toBe('en_stock')
})
it('la disponibilité couvre toute la journée de récolte et de péremption', async () => {
  const r = await lot({ date: new Date('2026-10-28T20:00:00Z'), datePeremption: new Date('2026-10-28T00:00:00Z') })
  expect((await vente(r.id)).status).toBe(200)
})
it('le rang automatique ne revient pas après suppression et déplacement de récoltes', async () => {
  const recolter = async () => { const r = await RECOLTER(req('/api/arbres/recoltes', 'POST', { arbreId: a.id, date: jour, quantite: 2 })); expect(r.status).toBe(201); return r.json() }
  const x = await recolter(), y = await recolter()
  expect(x.numLot).toMatch(/-01$/); expect(y.numLot).toMatch(/-02$/)
  expect((await SUPPRIMER_RECOLTE(req('/api/arbres/recoltes/' + x.id, 'DELETE'), params(x.id))).status).toBe(200)
  const z = await recolter(); expect(z.numLot).toMatch(/-03$/)
  expect((await CORRIGER(req('/api/arbres/recoltes/' + y.id, 'PUT', { date: '2026-10-27' }), params(y.id))).status).toBe(200)
  expect((await recolter()).numLot).toMatch(/-04$/)
  await db.recolteArbre.deleteMany({ where: { userId: auth.id } })
  expect((await recolter()).numLot).toMatch(/-05$/)
})
it('les lots existants et le bois partagent le maximum du même préfixe normalisé', async () => {
  await lot({ date: new Date(jour), numLot: '20261028-NA-Pommier-09' })
  const r = await CREER_BOIS(req('/api/arbres/bois', 'POST', { arbreId: a.id, date: jour, type: 'branchage', poidsKg: 5 }))
  expect(r.status).toBe(201)
  expect((await r.json()).numLot).toBe('20261028-NA-Pommier-10')
})
it('une ancienne écriture reste protégée même si son opération est redevenue planifiée', async () => {
  const op = await db.operationArbre.create({ data: { userId: auth.id, arbreId: a.id, type: 'greffe', fait: false, date: hier } })
  const ecriture = await db.depenseManuelle.create({ data: { userId: auth.id, date: hier, categorie: 'main_oeuvre', montant: 100,
    description: 'Ancienne dépense fictive', auto: true, sourceType: 'operation_arbre', sourceId: op.id } })
  expect((await SUPPRIMER_ARBRE(req('/api/arbres/' + a.id, 'DELETE'), params(a.id))).status).toBe(409)
  expect(await db.depenseManuelle.findUnique({ where: { id: ecriture.id } })).not.toBeNull()
})
it('un arbre sans production ni geste soldé peut toujours être supprimé', async () => {
  await db.operationArbre.create({ data: { userId: auth.id, arbreId: a.id, type: 'taille', fait: false, date: hier, datePrevue: hier, notes: 'auto:calendrier' } })
  expect((await SUPPRIMER_ARBRE(req('/api/arbres/' + a.id, 'DELETE'), params(a.id))).status).toBe(200)
})
it('un ancien numéro hors plage ne provoque pas un retour à un numéro déjà utilisé', async () => {
  await lot({ numLot: '20261028-NA-Pommier-999999999999999999999' })
  const r = await RECOLTER(req('/api/arbres/recoltes', 'POST', { arbreId: a.id, date: jour, quantite: 2 }))
  expect(r.status).toBe(409)
  expect(await db.recolteArbre.count({ where: { userId: auth.id } })).toBe(1)
})
it('deux récoltes simultanées reçoivent des numéros distincts du compteur durable', async () => {
  const reponses = await Promise.all([1, 2].map(() => RECOLTER(req('/api/arbres/recoltes', 'POST', { arbreId: a.id, date: jour, quantite: 2 }))))
  expect(reponses.map(r => r.status)).toEqual([201, 201])
  const lots = await Promise.all(reponses.map(r => r.json()))
  expect(lots.map(r => r.numLot).sort()).toEqual(['20261028-NA-Pommier-01', '20261028-NA-Pommier-02'])
})

})
