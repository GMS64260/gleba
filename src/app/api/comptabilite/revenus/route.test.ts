import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth:vi.fn(), ventes:vi.fn(), factures:vi.fn(), recoltes:vi.fn(),commandes:vi.fn(),exploitation:vi.fn() }))
vi.mock('@/lib/auth-utils',()=>({requireAuthApi:mocks.auth}))
vi.mock('@/lib/prisma',()=>({default:{
  venteManuelle:{findMany:mocks.ventes}, facture:{findMany:mocks.factures}, recolte:{findMany:mocks.recoltes},
  commandeBoutique:{findMany:mocks.commandes}, exploitation:{findUnique:mocks.exploitation},
  cibleReglement:{findMany:vi.fn(async()=>[])},
}}))
import { GET } from './route'
const date=new Date('2026-01-10T12:00:00Z')
const miroirs=[{id:31,userId:'qa',sourceType:'recolte_arbre',sourceId:7,sourceRef:null,auto:true,
  date,module:'verger',categorie:'fruits',description:'Vente fruits',quantite:10,unite:'kg',prixUnitaire:2,
  montant:20,paye:false,clientNom:'Client fictif',modeReglement:null,numeroPiece:null,tauxTVA:5.5,notes:null}]
beforeEach(()=>{
 vi.clearAllMocks();mocks.auth.mockResolvedValue({error:null,session:{user:{id:'qa'}}})
 mocks.ventes.mockImplementation(async(q:{select?:object})=>q.select?miroirs:miroirs)
 mocks.factures.mockResolvedValue([]);mocks.recoltes.mockResolvedValue([]);mocks.commandes.mockResolvedValue([])
 mocks.exploitation.mockResolvedValue({devise:'EUR',territoire:'METROPOLE'})
})
describe('Transactions et périmètre comptable commun',()=>{
 it('filtre le canal Boutique sans le confondre avec le module Autre',async()=>{
  const boutique={...miroirs[0],id:101,sourceType:'commande_boutique',sourceId:11,module:'potager',categorie:'legumes',montant:42}
  const autre={...miroirs[0],id:102,auto:false,sourceType:null,sourceId:null,module:'autre',categorie:'service',montant:17}
  mocks.ventes.mockResolvedValue([boutique,autre])
  mocks.factures.mockResolvedValue([{id:103,numero:'F-AUTRE',date,type:'facture',statut:'emise',clientNom:null,objet:null,totalTTC:9,
   factureOrigineId:null,emetteurSnapshot:{devise:'EUR'},lignes:[],_count:{}}])
  const r=await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026&module=boutique'))
  expect(r.status).toBe(200);const j=await r.json()
  expect(j.data).toMatchObject([{id:'manuel-101',module:'potager',montant:42}])
  expect(j.data).toHaveLength(1)
  expect(j.stats).toMatchObject({total:42,count:1,parModule:{potager:42,verger:0,elevage:0,autre:0},
   parDevise:[{monnaie:'EUR',total:42,count:1,parModule:{potager:42,verger:0,elevage:0,autre:0}}]})
  const a=await (await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026&module=autre'))).json()
  expect(a.data.map((l:{id:string})=>l.id)).toEqual(['facture-103','manuel-102'])
  expect(a.stats.total).toBe(26)
  const tous=await (await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026'))).json()
  expect(tous.stats.total).toBe(68);expect(tous.data).toHaveLength(3)
 })
 it.each(['boutique',' BoUtIqUe '])('inclut les ventes manuelles historiques de module %s',async module=>{
  mocks.ventes.mockResolvedValue([{...miroirs[0],id:104,auto:false,sourceType:null,sourceId:null,module,categorie:'legumes',montant:21}])
  const j=await (await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026&module=boutique'))).json()
  expect(j.data).toMatchObject([{id:'manuel-104',module:'potager',montant:21}]);expect(j.data).toHaveLength(1)
  expect(j.stats.total).toBe(21);expect(j.stats.parModule.potager).toBe(21)
  expect(j.stats.parDevise).toMatchObject([{monnaie:'EUR',total:21,count:1}])
 })
 it('calcule tout le canal avant pagination, par module et devise, sans retenir un faux marqueur boutique',async()=>{
  const contexte=(devise:string)=>({version:1,regimeTva:'franchise-293b',territoire:devise==='EUR'?'METROPOLE':'NOUVELLE_CALEDONIE',devise,date:date.toISOString()})
  mocks.ventes.mockResolvedValue([
   {...miroirs[0],id:105,sourceType:'commande_boutique',montant:12,contexteFiscal:contexte('EUR')},
   {...miroirs[0],id:106,sourceType:'commande_boutique',module:'elevage',montant:500,contexteFiscal:contexte('XPF')},
   {...miroirs[0],id:107,sourceType:'recolte',module:'boutique',montant:90},
   {...miroirs[0],id:108,auto:false,sourceType:'commande_boutique',module:'autre',montant:80},
  ])
  const j=await (await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026&module=boutique&limit=1'))).json()
  expect(j.data).toHaveLength(1)
  // 12 € + 500 F ne font pas « 512 » : total et modules null, détail par devise (lot devise-totaux-api).
  expect(j.stats).toMatchObject({total:null,count:2,parModule:{potager:null,verger:null,elevage:null,autre:null},
   totalParDevise:[{monnaie:'EUR',total:12,count:1},{monnaie:'XPF',total:500,count:1}],
   parDevise:[{monnaie:'EUR',total:12,count:1,parModule:expect.objectContaining({verger:12})},
    {monnaie:'XPF',total:500,count:1,parModule:expect.objectContaining({elevage:500})}]})
 })
 it('reprend le montant du miroir et conserve l’accès à la source et aux règlements',async()=>{
  const r=await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026'))
  expect(r.status).toBe(200);const j=await r.json()
  expect(j.stats.total).toBe(20);expect(j.data).toMatchObject([{id:'recolte-arbre-7',source:'RecolteArbre',montant:20,paye:false,ecriture:{id:31}}])
 })
 it('facture stock et avoir figurent une seule fois avec leur signe et leur module',async()=>{
  const fs=[{id:51,numero:'F-QA-51',date,type:'facture',statut:'emise',clientNom:'Client fictif',objet:'Pommes',totalTTC:100,factureOrigineId:null,emetteurSnapshot:{devise:'EUR'},
   lignes:[{articleStockType:'fruit'}],_count:{}},
   {id:52,numero:'AV-QA-52',date,type:'avoir',statut:'emise',clientNom:'Client fictif',objet:'Correction',totalTTC:20,factureOrigineId:51,emetteurSnapshot:{devise:'EUR'},lignes:[],_count:{}}]
  mocks.ventes.mockResolvedValue([])
  mocks.factures.mockImplementation(async(q:{select?:{numero?:boolean;totalTTC?:boolean}})=>q.select?.totalTTC?fs:fs.map(f=>({id:f.id,numero:f.numero})))
  const r=await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026&module=verger'));const j=await r.json()
  expect(j.stats.total).toBe(80);expect(j.stats.parModule.verger).toBe(80);expect(j.data).toHaveLength(2)
  expect(j.data.find((l:{montant:number})=>l.montant===-20)).toMatchObject({source:'Facture',reglementsDisponibles:false,monnaie:'EUR'})
  expect(j.data.find((l:{montant:number})=>l.montant===100)).toMatchObject({monnaie:'EUR'})
  // L'instantané est lu côté serveur pour la devise, jamais renvoyé (lot devise-totaux-api).
  expect(mocks.factures.mock.calls[0][0].select.emetteurSnapshot).toBe(true)
  expect(j.data.every((l:object)=>!('emetteurSnapshot' in l))).toBe(true)
 })
 it.each([[{devise:'XPF',rib:'FR76 FICTIF',adresseSiege:'1 voie fictive'},'XPF'],[null,'EUR']] as const)('transmet la devise propre à la pièce sans son instantané ni repli exploitation (%o)',async(emetteurSnapshot,monnaie)=>{
  mocks.ventes.mockResolvedValue([])
  mocks.factures.mockResolvedValue([{id:53,numero:'F-QA-53',date,type:'facture',statut:'emise',clientNom:'Client fictif',objet:null,totalTTC:1234.56,
   factureOrigineId:null,emetteurSnapshot,lignes:[],_count:{}}])
  const r=await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026'));const brut=await r.text();const j=JSON.parse(brut)
  expect(j.data[0]).toMatchObject({source:'Facture',montant:1234.56,monnaie})
  expect(j.data[0]).not.toHaveProperty('emetteurSnapshot')
  expect(brut).not.toContain('FR76 FICTIF');expect(brut).not.toContain('1 voie fictive')
 })
 it('ferme passée en XPF : facture EUR puis avoir EUR restent un total EUR, jamais réétiqueté (ADV dev-170)',async()=>{
  mocks.exploitation.mockResolvedValue({devise:'XPF',territoire:'NOUVELLE_CALEDONIE'})
  mocks.ventes.mockResolvedValue([])
  const fs=[{id:61,numero:'F-QA-61',date,type:'facture',statut:'emise',clientNom:'Client fictif',objet:null,totalTTC:105.5,factureOrigineId:null,emetteurSnapshot:{devise:'EUR',territoire:'METROPOLE'},lignes:[],_count:{}},
   {id:62,numero:'AV-QA-62',date,type:'avoir',statut:'emise',clientNom:'Client fictif',objet:null,totalTTC:52.75,factureOrigineId:61,emetteurSnapshot:{devise:'EUR',territoire:'METROPOLE'},lignes:[],_count:{}}]
  mocks.factures.mockImplementation(async(q:{select?:{totalTTC?:boolean}})=>q.select?.totalTTC?fs:fs.map(f=>({id:f.id,numero:f.numero})))
  const j=await (await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026'))).json()
  expect(j.stats.parDevise).toEqual([{monnaie:'EUR',count:2,total:52.75,parModule:expect.objectContaining({autre:52.75,potager:0})}])
 })
 it.each([null, {}])('facture ancienne sans identité monétaire (%o) : ligne et total EUR sur ferme XPF', async emetteurSnapshot => {
  mocks.exploitation.mockResolvedValue({devise:'XPF',territoire:'NOUVELLE_CALEDONIE'})
  mocks.ventes.mockResolvedValue([])
  mocks.factures.mockResolvedValue([{id:63,numero:'F-ANCIENNE',date,type:'facture',statut:'emise',clientNom:null,objet:null,totalTTC:105.5,factureOrigineId:null,emetteurSnapshot,lignes:[],_count:{}}])
  const j=await (await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026'))).json()
  expect(j.data[0].monnaie).toBe('EUR')
  expect(j.stats.parDevise).toEqual([{monnaie:'EUR',count:1,total:105.5,parModule:expect.objectContaining({autre:105.5})}])
 })
 it('ventile EUR, XPF et devise inconnue sans les additionner, sur tout le périmètre et par module',async()=>{
  mocks.exploitation.mockResolvedValue({devise:'XPF',territoire:'NOUVELLE_CALEDONIE'})
  const contexte=(devise:string)=>({version:1,regimeTva:'franchise-293b',territoire:devise==='EUR'?'METROPOLE':'NOUVELLE_CALEDONIE',devise,date:'2026-01-10T12:00:00.000Z'})
  mocks.ventes.mockResolvedValue([
   {...miroirs[0],id:41,montant:20,contexteFiscal:contexte('EUR')},
   {...miroirs[0],id:42,sourceId:8,montant:5000,contexteFiscal:null},
   {...miroirs[0],id:43,sourceId:9,montant:7,contexteFiscal:{version:9}},
  ])
  const fs=[{id:71,numero:'F-QA-71',date:new Date('2026-06-29'),type:'facture',statut:'emise',clientNom:null,objet:null,totalTTC:30,factureOrigineId:null,emetteurSnapshot:{territoire:''},lignes:[],_count:{}}]
  mocks.factures.mockImplementation(async(q:{select?:{totalTTC?:boolean}})=>q.select?.totalTTC?fs:fs.map(f=>({id:f.id,numero:f.numero})))
  const j=await (await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026&limit=1'))).json()
  expect(j.data).toHaveLength(1)
  expect(j.stats.parDevise.map((g:{monnaie:string|null;total:number})=>[g.monnaie,g.total])).toEqual([['EUR',20],['XPF',5000],[null,37]])
  expect(j.stats.parDevise[1].parModule.verger).toBe(5000)
  // Trois devises : aucun total historique, un voisin par devise (lot devise-totaux-api).
  expect(j.stats.total).toBeNull()
  expect(j.stats.totalParDevise).toEqual([{monnaie:'EUR',total:20,count:1},{monnaie:'XPF',total:5000,count:1},{monnaie:null,total:37,count:2}])
  expect(Object.values(j.stats.parModule).every(v=>v===null)).toBe(true)
  expect(j.stats.parCategorie.every((c:{montant:number|null})=>c.montant===null)).toBe(true)
  const v=await (await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026&module=verger'))).json()
  expect(v.stats.parDevise.map((g:{monnaie:string|null;total:number})=>[g.monnaie,g.total])).toEqual([['EUR',20],['XPF',5000],[null,7]])
  expect(mocks.exploitation).toHaveBeenCalledWith({where:{userId:'qa'},select:{devise:true,territoire:true}})
 })
 it('conserve le nom client des anciennes commandes boutique sans modifier leur montant',async()=>{
  mocks.ventes.mockResolvedValue([{...miroirs[0],id:91,sourceType:'commande_boutique',sourceId:11,clientNom:null,categorie:'epicerie',montant:30}])
  mocks.commandes.mockResolvedValue([{id:11,clientNom:'Client boutique fictif'}])
  const j=await (await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026'))).json()
  expect(j.data[0]).toMatchObject({client:'Client boutique fictif',montant:30,categorie:'Épicerie'})
  expect(mocks.commandes).toHaveBeenCalledWith({where:{userId:'qa',id:{in:[11]}},select:{id:true,clientNom:true}})
 })
 it('lit l’exercice en cours jusqu’au 31/12 comme les dépenses : une vente datée de demain reste visible',async()=>{
  const annee=new Date().getFullYear(),fin=new Date(annee,11,31,23,59,59,999)
  await GET(new NextRequest('http://localhost/api/comptabilite/revenus'))
  expect(mocks.ventes.mock.calls[0][0].where.date.lte).toEqual(fin)
  expect(mocks.factures.mock.calls[0][0].where.date.lte).toEqual(fin)
 })
 it('scope toutes les lectures au propriétaire et refuse une année invalide',async()=>{
  await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026'))
  expect(mocks.ventes.mock.calls.every(([q])=>q.where.userId==='qa')).toBe(true)
  expect(mocks.factures.mock.calls.every(([q])=>q.where.userId==='qa')).toBe(true)
  expect((await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=x'))).status).toBe(400)
 })
})
