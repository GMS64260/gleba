import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth:vi.fn(), ventes:vi.fn(), factures:vi.fn(), recoltes:vi.fn(),commandes:vi.fn() }))
vi.mock('@/lib/auth-utils',()=>({requireAuthApi:mocks.auth}))
vi.mock('@/lib/prisma',()=>({default:{
  venteManuelle:{findMany:mocks.ventes}, facture:{findMany:mocks.factures}, recolte:{findMany:mocks.recoltes},
  commandeBoutique:{findMany:mocks.commandes},
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
})
describe('Transactions et périmètre comptable commun',()=>{
 it('reprend le montant du miroir et conserve l’accès à la source et aux règlements',async()=>{
  const r=await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026'))
  expect(r.status).toBe(200);const j=await r.json()
  expect(j.stats.total).toBe(20);expect(j.data).toMatchObject([{id:'recolte-arbre-7',source:'RecolteArbre',montant:20,paye:false,ecriture:{id:31}}])
 })
 it('facture stock et avoir figurent une seule fois avec leur signe et leur module',async()=>{
  const fs=[{id:51,numero:'F-QA-51',date,type:'facture',statut:'emise',clientNom:'Client fictif',objet:'Pommes',totalTTC:100,factureOrigineId:null,
   lignes:[{articleStockType:'fruit'}],_count:{}},
   {id:52,numero:'AV-QA-52',date,type:'avoir',statut:'emise',clientNom:'Client fictif',objet:'Correction',totalTTC:20,factureOrigineId:51,lignes:[],_count:{}}]
  mocks.ventes.mockResolvedValue([])
  mocks.factures.mockImplementation(async(q:{select?:{numero?:boolean;totalTTC?:boolean}})=>q.select?.totalTTC?fs:fs.map(f=>({id:f.id,numero:f.numero})))
  const r=await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026&module=verger'));const j=await r.json()
  expect(j.stats.total).toBe(80);expect(j.stats.parModule.verger).toBe(80);expect(j.data).toHaveLength(2)
  expect(j.data.find((l:{montant:number})=>l.montant===-20)).toMatchObject({source:'Facture',reglementsDisponibles:false})
 })
 it('conserve le nom client des anciennes commandes boutique sans modifier leur montant',async()=>{
  mocks.ventes.mockResolvedValue([{...miroirs[0],id:91,sourceType:'commande_boutique',sourceId:11,clientNom:null,categorie:'epicerie',montant:30}])
  mocks.commandes.mockResolvedValue([{id:11,clientNom:'Client boutique fictif'}])
  const j=await (await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026'))).json()
  expect(j.data[0]).toMatchObject({client:'Client boutique fictif',montant:30,categorie:'Épicerie'})
  expect(mocks.commandes).toHaveBeenCalledWith({where:{userId:'qa',id:{in:[11]}},select:{id:true,clientNom:true}})
 })
 it('scope toutes les lectures au propriétaire et refuse une année invalide',async()=>{
  await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=2026'))
  expect(mocks.ventes.mock.calls.every(([q])=>q.where.userId==='qa')).toBe(true)
  expect(mocks.factures.mock.calls.every(([q])=>q.where.userId==='qa')).toBe(true)
  expect((await GET(new NextRequest('http://localhost/api/comptabilite/revenus?year=x'))).status).toBe(400)
 })
})
