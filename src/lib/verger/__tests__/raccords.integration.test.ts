import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { NextRequest } from 'next/server'
const auth = vi.hoisted(() => ({ id: '' }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: async () => ({ error: null,
  session: { user: { id: auth.id, acteurId: auth.id, peutEcrireExploitation: true, estProprietaireExploitation: true } },
}) }))
import db from '@/lib/prisma'
import * as calendrier from '@/lib/verger/creation-arbre'
import { POST as planter } from '@/app/api/arbres/route'
import { PUT as corrigerArbre, DELETE as supprimerArbre } from '@/app/api/arbres/[id]/route'
import { PUT as corrigerFruit, DELETE as supprimerFruit } from '@/app/api/arbres/recoltes/[id]/route'
import { DELETE as annulerSortieFruit } from '@/app/api/arbres/recoltes/[id]/sorties/[sortieId]/route'
import { POST as dupliquer } from '@/app/api/arbres/[id]/dupliquer/route'
import { PUT as corrigerCampagne } from '@/app/api/arbres/campagnes/[id]/route'
import { POST as creerOperation } from '@/app/api/arbres/operations/route'
import { PUT as corrigerOperation } from '@/app/api/arbres/operations/[id]/route'
import { GET as depenses } from '@/app/api/comptabilite/depenses/route'
import { GET as revenus } from '@/app/api/comptabilite/revenus/route'
import { POST as facturerDirect } from '@/app/api/comptabilite/factures/route'
import { GET as fec } from '@/app/api/comptabilite/export/fec/route'
import { GET as listeFruits } from '@/app/api/arbres/recoltes/route'
import { modifierVenteVerger } from '@/lib/verger/vente'
import { chargerCatalogueStock } from '@/lib/commercial/catalogue-stock'
import { retournerStockCommercial } from '@/lib/commercial/stock'
import { creerDocument, agirSurDocument, facturerDocuments } from '@/lib/commercial/service'
import { contenuDocumentSchema } from '@/lib/commercial/regles'
import { creerFacture } from '@/lib/facture-utils'
import { getKpiCompta } from '@/lib/kpi/compta'
import { clearKpiCache } from '@/lib/kpi/cache'
import { enregistrerReglement } from '@/lib/comptabilite/reglements'
import { nouveauReglementSchema } from '@/lib/validations/reglements'
import { exportAccount, importAccount } from '@/lib/account-transfer'

const now = new Date('2026-10-28T12:00:00Z')
const date = new Date('2026-10-20T12:00:00Z')
const jour = '2026-10-28'
const req = (path: string, method = 'GET', body?: object) => new NextRequest('http://localhost'+path, {
  method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
})
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const payloadArbre = { nom: 'Pommier synthétique', type: 'fruitier', espece: 'Pommier',
  datePlantation: '2026-10-20', dateAchat: '2026-10-20', prixAchat: 500 }
let arbre: Awaited<ReturnType<typeof db.arbre.create>>
let client: Awaited<ReturnType<typeof db.client.create>>
const kpi = () => { clearKpiCache(); return getKpiCompta(auth.id, 2026, now) }
const fruit = (data: object = {}) => db.recolteArbre.create({ data: { userId: auth.id, arbreId: arbre.id, date, quantite: 10, ...data } })
const sortie = (id: number, statut: string, data: object = {}) => modifierVenteVerger('fruit', auth.id, auth.id, id,
  { statut, date: now.toISOString(), cleIdempotence: randomUUID(), ...data })
const contenu = (fruitId: number, quantite = 4, dateLivraison = jour) => contenuDocumentSchema.parse({
  type: 'livraison', clientId: client.id, date: dateLivraison, dateValidite: null, dateLivraison,
  objet: 'Livraison synthétique', lignes: [{ description: 'Pommes synthétiques', quantite, unite: 'kg', prixUnitaire: 25, tauxTVA: 0,
    articleStockType: 'fruit', articleStockId: String(fruitId) }],
})
async function livrer(id: number, quantite = 4, dateLivraison = jour) {
  const document = await creerDocument(auth.id, randomUUID(), contenu(id, quantite, dateLivraison))
  await agirSurDocument(auth.id, document.id, 'emettre')
  await agirSurDocument(auth.id, document.id, 'livrer', dateLivraison)
  return document
}

describe.skipIf(!process.env.GLEBA_VERGER_RACCORDS_QA_DATABASE_URL)('Raccords verger : PostgreSQL synthétique', () => {
  beforeAll(() => {
    const url = process.env.DATABASE_URL || ''
    if (url !== process.env.GLEBA_VERGER_RACCORDS_QA_DATABASE_URL || !/^\/gleba_verger_qa_raccords_[0-9a-f]{8}$/.test(new URL(url).pathname)) throw new Error('Base QA dédiée obligatoire')
  })
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); clearKpiCache()
    const user = await db.user.create({ data: { email: `raccords-${randomUUID()}@example.test`, emailVerified: true } })
    auth.id = user.id
    await db.exploitation.create({ data: { userId: user.id, raisonSociale: 'Ferme synthétique', formeJuridique: 'EI', regimeFiscal: 'micro-BA',
      adresseSiege: '1 voie fictive', codePostal: '64000', ville: 'Essai', emailContact: 'qa@example.test', regimeTva: 'reel-normal' } })
    arbre = await db.arbre.create({ data: { userId: user.id, nom: 'Arbre synthétique', type: 'fruitier', espece: 'Pommier', posX: 0, posY: 0 } })
    client = await db.client.create({ data: { userId: user.id, nom: 'Client synthétique' } })
  })
  afterAll(async () => { vi.useRealTimers(); await db.$disconnect() })

  it('achat créé puis corrigé : Transactions, KPI et FEC portent une seule dépense', async () => {
    const r = await planter(req('/api/arbres', 'POST', payloadArbre)); expect(r.status).toBe(201)
    const a = await r.json()
    const mirrors = () => db.depenseManuelle.findMany({ where: { userId: auth.id, sourceType: 'achat_arbre', sourceId: a.id } })
    // Présumé réglé comme les achats d'animaux (décision du 2026-10-30).
    expect(await mirrors()).toMatchObject([{ montant: 500, paye: true, comptable: true }])
    expect((await kpi()).depensesYtd).toBe(500)
    const list = await (await depenses(req('/api/comptabilite/depenses?year=2026'))).json()
    expect(list.stats.totalComptable).toBe(500); expect(list.data.find((l: { source: string }) => l.source === 'Arbre').ecriture.id).toBe((await mirrors())[0].id)
    const f = await (await fec(req('/api/comptabilite/export/fec?exercice=2026&check=1'))).json()
    expect(f.ventilation.depenses).toBe(1); expect(f.validation.valide).not.toBe(false)
    const edited = await corrigerArbre(req('/api/arbres/'+a.id, 'PUT', { prixAchat: 600 }), params(a.id)); expect(edited.status).toBe(200)
    expect((await mirrors()).map(m => m.montant)).toEqual([600]); expect((await kpi()).depensesYtd).toBe(600)
    // Revue du 2026-10-29 : un achat sans versement part avec l'arbre, dans la même transaction.
    expect((await supprimerArbre(req('/api/arbres/'+a.id, 'DELETE'), params(a.id))).status).toBe(200)
    expect(await mirrors()).toEqual([]); expect((await kpi()).depensesYtd).toBe(0)
  })

  it('achat réglé par un versement actif : suppression refusée, arbre et dépense conservés', async () => {
    const a = await (await planter(req('/api/arbres', 'POST', payloadArbre))).json()
    const miroir = await db.depenseManuelle.findFirstOrThrow({ where: { userId: auth.id, sourceType: 'achat_arbre', sourceId: a.id } })
    await enregistrerReglement(auth.id,auth.id,nouveauReglementSchema.parse({type:'DepenseManuelle',id:miroir.id,montant:500,date,modeReglement:'Virement',cleIdempotence:randomUUID()}))
    const refus = await supprimerArbre(req('/api/arbres/'+a.id, 'DELETE'), params(a.id))
    expect(refus.status).toBe(409); expect((await refus.json()).error).toContain('Archivez')
    expect(await db.arbre.count({ where: { id: a.id } })).toBe(1)
    expect(await db.depenseManuelle.count({ where: { id: miroir.id } })).toBe(1)
  })

  it('reprise des achats antérieurs : idempotente, puis présumée réglée par la migration du 2026-10-30', async () => {
    const ancien = await db.arbre.update({ where: { id: arbre.id }, data: { prixAchat: 90, dateAchat: date } })
    const sql = readFileSync('prisma/migrations/20261028193000_verger_raccords_comptables/migration.sql','utf8').split('INSERT INTO depenses_manuelles')[1]
    await db.$executeRawUnsafe('INSERT INTO depenses_manuelles'+sql)
    await db.$executeRawUnsafe('INSERT INTO depenses_manuelles'+sql)
    const achat = () => db.depenseManuelle.findMany({ where: { userId: auth.id, sourceType: 'achat_arbre', sourceId: ancien.id } })
    expect(await achat()).toMatchObject([{ montant: 90, paye: false }])
    const reglee = readFileSync('prisma/migrations/20261030090000_achats_arbres_presumes_regles/migration.sql','utf8')
    await db.$executeRawUnsafe(reglee)
    await db.$executeRawUnsafe(reglee)
    expect(await achat()).toMatchObject([{ montant: 90, paye: true, montantHT: 81.82, notes: "Achat repris depuis la fiche arbre ; présumé réglé à l'achat." }])
    const [ligne] = await achat()
    expect(Math.round(((ligne.montantHT ?? 0) + (ligne.montantTVA ?? 0)) * 100) / 100).toBe(90)
  })

  it('panne calendrier : création annulée et reprise sans doublon', async () => {
    const spy = vi.spyOn(calendrier, 'genererCalendrierEntretien').mockRejectedValueOnce(new Error('Panne synthétique'))
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {})
    try { expect((await planter(req('/api/arbres', 'POST', payloadArbre))).status).toBe(500) }
    finally { spy.mockRestore(); erreur.mockRestore() }
    expect(await db.arbre.count({ where: { userId: auth.id, nom: payloadArbre.nom } })).toBe(0)
    expect(await db.depenseManuelle.count({ where: { userId: auth.id } })).toBe(0)
    expect((await planter(req('/api/arbres', 'POST', payloadArbre))).status).toBe(201)
    expect(await db.arbre.count({ where: { userId: auth.id, nom: payloadArbre.nom } })).toBe(1)
  })

  it('copies : achat et calendrier atomiques, panne de la seconde copie sans effet partiel', async () => {
    await db.arbre.update({ where: { id: arbre.id }, data: { prixAchat: 30, dateAchat: date } })
    const spy = vi.spyOn(calendrier, 'genererCalendrierEntretien').mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('Panne synthétique'))
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {})
    try { expect((await dupliquer(req('/api/arbres/1/dupliquer','POST',{nombre:2,recopierAchat:true}),params(arbre.id))).status).toBe(500) }
    finally { spy.mockRestore(); erreur.mockRestore() }
    expect(await db.arbre.count({ where: { userId: auth.id } })).toBe(1)
    expect(await db.depenseManuelle.count({ where: { userId: auth.id } })).toBe(0)
  })

  it('coût de campagne : Transactions, suivi et KPI concordent', async () => {
    const c = await db.campagnePlantation.create({ data: { userId: auth.id, nom: 'Campagne synthétique', typeFormation: 'verger', datePlantationReelle: date } })
    expect((await corrigerCampagne(req('/api/arbres/campagnes/'+c.id,'PUT',{coutReel:250}),params(c.id))).status).toBe(200)
    const list = await (await depenses(req('/api/comptabilite/depenses?year=2026'))).json()
    expect(list.stats.totalComptable).toBe(250); expect((await kpi()).depensesYtd).toBe(250)
    expect(list.data).toMatchObject([{ source:'CampagnePlantation', ecriture:{ id:expect.any(Number) }, paye:true }])
  })

  it('vente par BL, facture et avoir : les revenus de Transactions suivent exactement le KPI', async () => {
    const r = await fruit(); const bl = await livrer(r.id)
    expect((await kpi()).revenusYtd).toBe(0)
    const facture = await facturerDocuments(auth.id,[bl.id],jour)
    let list = await (await revenus(req('/api/comptabilite/revenus?year=2026&module=verger'))).json()
    expect(list.stats.total).toBe(100); expect((await kpi()).revenusYtd).toBe(100); expect(list.data).toHaveLength(1)
    await db.$transaction(tx => creerFacture(tx,{userId:auth.id,type:'avoir',date:now,clientId:client.id,clientNom:client.nom,
      objet:'Correction synthétique',factureOrigineId:facture!.id,statut:'emise',totalHT:20,totalTVA:0,totalTTC:20,
      lignes:[{description:'Correction',quantite:1,unite:'unité',prixUnitaire:20,tauxTVA:0,montantHT:20,montantTVA:0,montantTTC:20}]}))
    list = await (await revenus(req('/api/comptabilite/revenus?year=2026&module=verger'))).json()
    expect(list.stats.total).toBe(80); expect((await kpi()).revenusYtd).toBe(80)
    expect(list.data.find((l:{montant:number})=>l.montant<0).reglementsDisponibles).toBe(false)
  })

  it('perte après BL : production et CA conservés, reliquat et historique exacts, reprise idempotente', async () => {
    const r = await fruit(); const bl = await livrer(r.id)
    await facturerDocuments(auth.id,[bl.id],jour)
    const cleIdempotence=randomUUID()
    await sortie(r.id,'perte',{quantite:2,cleIdempotence,notes:'Tri synthétique'})
    await sortie(r.id,'perte',{quantite:2,cleIdempotence,notes:'Tri synthétique'})
    expect(await db.recolteArbre.findUniqueOrThrow({where:{id:r.id}})).toMatchObject({quantite:10,stockDisponibleCommercial:4,statut:'en_stock'})
    expect(await db.mouvementStockCommercial.count({where:{userId:auth.id,fruitId:r.id,nature:'perte'}})).toBe(1)
    expect((await kpi()).revenusYtd).toBe(100)
    const liste = await (await listeFruits(req('/api/arbres/recoltes'))).json()
    expect(liste.find((l:{id:number})=>l.id===r.id).mouvementsCommerciaux).toMatchObject([{nature:'perte',quantite:2}])
    expect(liste.find((l:{id:number})=>l.id===r.id).ventesCommerciales).toHaveLength(1)
    await db.$transaction(tx => retournerStockCommercial(tx,auth.id,{documentId:bl.id}))
    expect((await db.recolteArbre.findUniqueOrThrow({where:{id:r.id}})).stockDisponibleCommercial).toBe(8)
    expect((await kpi()).revenusYtd).toBe(100)
  })

  it('usage interne du reliquat et bois : quantité conservée avec son unité', async () => {
    const r=await fruit({stockDisponibleCommercial:6})
    await sortie(r.id,'consomme')
    expect((await db.recolteArbre.findUniqueOrThrow({where:{id:r.id}})).stockDisponibleCommercial).toBe(0)
    const b=await db.productionBois.create({data:{userId:auth.id,date,type:'branchage',volumeM3:3,volumeStere:5,stockDisponibleCommercial:3}})
    await modifierVenteVerger('bois',auth.id,auth.id,b.id,{statut:'utilise',quantite:2,cleIdempotence:randomUUID(),notes:'Paillage',date:now.toISOString()})
    expect(await db.mouvementStockCommercial.findFirst({where:{userId:auth.id,boisId:b.id}})).toMatchObject({nature:'utilise',quantite:2,unite:'stère'})
    expect((await db.productionBois.findUniqueOrThrow({where:{id:b.id}})).stockDisponibleCommercial).toBe(1)
  })

  it('deux pertes concurrentes ne dépassent pas le reliquat et les références tierces sont refusées', async () => {
    const r=await fruit({stockDisponibleCommercial:6})
    const rs=await Promise.allSettled([sortie(r.id,'perte',{quantite:4}),sortie(r.id,'consomme',{quantite:4})])
    expect(rs.filter(r=>r.status==='fulfilled')).toHaveLength(1)
    expect((await db.recolteArbre.findUniqueOrThrow({where:{id:r.id}})).stockDisponibleCommercial).toBe(2)
    const autre=await db.user.create({data:{email:`tiers-${randomUUID()}@example.test`}})
    await expect(modifierVenteVerger('fruit',autre.id,autre.id,r.id,{statut:'perte',cleIdempotence:randomUUID()})).rejects.toMatchObject({status:404})
  })

  it('panne du journal physique : débit du reliquat annulé dans la même transaction', async () => {
    const r=await fruit({stockDisponibleCommercial:6})
    await db.$executeRawUnsafe("ALTER TABLE mouvements_stock_commerciaux ADD CONSTRAINT qa_refus_journal CHECK (notes IS DISTINCT FROM 'QA_PANNE_JOURNAL')")
    try { await expect(sortie(r.id,'perte',{quantite:2,notes:'QA_PANNE_JOURNAL'})).rejects.toThrow(/constraint|qa_refus_journal/i) }
    finally { await db.$executeRawUnsafe('ALTER TABLE mouvements_stock_commerciaux DROP CONSTRAINT qa_refus_journal') }
    expect((await db.recolteArbre.findUniqueOrThrow({where:{id:r.id}})).stockDisponibleCommercial).toBe(6)
  })

  it('BL historique : catalogue et livraison utilisent le jour réel avant péremption', async () => {
    const r=await fruit({datePeremption:new Date('2026-10-25T12:00:00Z')})
    expect((await chargerCatalogueStock(auth.id)).some(a=>a.id===String(r.id)&&a.type==='fruit')).toBe(false)
    const document=await livrer(r.id,4,'2026-10-22')
    expect((await db.recolteArbre.findUniqueOrThrow({where:{id:r.id}})).stockDisponibleCommercial).toBe(6)
    expect(await db.mouvementStockCommercial.findFirst({where:{documentId:document.id}})).toMatchObject({quantite:4})
    await expect(livrer(r.id,1,'2026-10-27')).rejects.toThrow(/stock|disponible/i)
  })

  it('facture directe historique : sélection, contrôle et mouvement au même jour', async () => {
    const r=await fruit({datePeremption:new Date('2026-10-25T12:00:00Z')})
    const reponse=await facturerDirect(req('/api/comptabilite/factures','POST',{
      type:'facture',statut:'emise',date:'2026-10-22',clientId:client.id,clientNom:client.nom,objet:'Pommes historiques',
      totalHT:20,totalTVA:0,totalTTC:20,cleCreationStock:randomUUID(),
      lignes:[{description:'Pommes historiques',quantite:4,unite:'kg',prixUnitaire:5,tauxTVA:0,montantHT:20,montantTVA:0,montantTTC:20,articleStockType:'fruit',articleStockId:String(r.id)}],
    }))
    expect(reponse.status).toBe(201)
    expect((await db.recolteArbre.findUniqueOrThrow({where:{id:r.id}})).stockDisponibleCommercial).toBe(6)
    expect((await db.mouvementStockCommercial.findFirstOrThrow({where:{userId:auth.id,fruitId:r.id}})).date.toISOString().slice(0,10)).toBe('2026-10-22')
  })

  // Décision du 2026-10-30 : une opération d'arbre naît payée, comme un soin ;
  // corriger son coût garde le pointage, sauf journal de versements détaillés.
  it('coût payé corrigé : pointage gardé sans journal, solde recalculé avec versements détaillés', async () => {
    const reponse=await creerOperation(req('/api/arbres/operations','POST',{arbreId:arbre.id,type:'taille',fait:true,cout:100,date:date.toISOString()}))
    expect(reponse.status).toBe(201); const op=await reponse.json()
    const miroir=()=>db.depenseManuelle.findFirstOrThrow({where:{userId:auth.id,sourceType:'operation_arbre',sourceId:op.id}})
    const { id } = await miroir()
    await db.depenseManuelle.update({where:{id},data:{modeReglement:'Chèque',numeroPiece:'CHQ-QA'}})
    expect((await corrigerOperation(req('/api/arbres/operations/'+op.id,'PUT',{cout:150}),params(op.id))).status).toBe(200)
    expect((await db.operationArbre.findUniqueOrThrow({where:{id:op.id}})).cout).toBe(150)
    const corrige=await miroir()
    expect(corrige).toMatchObject({montant:150,paye:true,modeReglement:'Chèque',numeroPiece:'CHQ-QA'})
    await enregistrerReglement(auth.id,auth.id,nouveauReglementSchema.parse({type:'DepenseManuelle',id:corrige.id,montant:100,date,modeReglement:'Virement',cleIdempotence:randomUUID()}))
    expect((await corrigerOperation(req('/api/arbres/operations/'+op.id,'PUT',{cout:200}),params(op.id))).status).toBe(200)
    expect(await miroir()).toMatchObject({montant:200,paye:false})
  })

  // Revue du 2026-10-29 : la correction du lot suppose la migration qui borne
  // le trigger `proteger_lot_commercial` aux lots livrés par BL ou facture.
  it('perte sur un lot jamais livré : annulable, lot corrigeable puis supprimable', async () => {
    const r=await fruit(); await sortie(r.id,'perte',{quantite:2})
    const { id: sortieId } = await db.mouvementStockCommercial.findFirstOrThrow({where:{userId:auth.id,fruitId:r.id,nature:'perte'}})
    const annuler = () => annulerSortieFruit(req(`/api/arbres/recoltes/${r.id}/sorties/${sortieId}`,'DELETE'),{params:Promise.resolve({id:String(r.id),sortieId})})
    expect((await annuler()).status).toBe(200)
    expect(await (await annuler()).json()).toMatchObject({dejaAnnulee:true})
    expect(await db.recolteArbre.findUniqueOrThrow({where:{id:r.id}})).toMatchObject({quantite:10,stockDisponibleCommercial:null})
    await sortie(r.id,'perte',{quantite:3})
    expect((await corrigerFruit(req('/api/arbres/recoltes/'+r.id,'PUT',{quantite:2}),params(r.id))).status).toBe(409)
    expect((await corrigerFruit(req('/api/arbres/recoltes/'+r.id,'PUT',{quantite:12}),params(r.id))).status).toBe(200)
    expect(await db.recolteArbre.findUniqueOrThrow({where:{id:r.id}})).toMatchObject({quantite:12,stockDisponibleCommercial:9})
    expect((await supprimerFruit(req('/api/arbres/recoltes/'+r.id,'DELETE'),params(r.id))).status).toBe(200)
    expect(await db.mouvementStockCommercial.count({where:{userId:auth.id,fruitId:r.id}})).toBe(0)
  })

  it('export puis import gardent motif, clé et quantité des sorties physiques', async () => {
    const r=await fruit(); await sortie(r.id,'perte',{quantite:2,notes:'Tri synthétique'})
    const contenu=await exportAccount(auth.id)
    const autre=await db.user.create({data:{email:`import-${randomUUID()}@example.test`}})
    await db.user.delete({where:{id:auth.id}}) // Transfert entre instances : aucun cuid source sur la cible.
    const transfert=await importAccount(autre.id,contenu)
    expect(transfert.skipped.MouvementStockCommercial ?? 0).toBe(0)
    expect(await db.mouvementStockCommercial.findFirst({where:{userId:autre.id,nature:'perte'}})).toMatchObject({nature:'perte',quantite:2,notes:'Tri synthétique'})
  })
})
