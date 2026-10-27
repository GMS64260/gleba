import { beforeEach, expect, it, vi } from 'vitest'
type RecolteTemoin = { especeId: string; espece: { couleur: string | null }; quantite: number; unite: string; date: Date }
const m=vi.hoisted(()=>({db:{} as Record<string, unknown>,cultures:[] as ReturnType<typeof culture>[],recoltes:[] as RecolteTemoin[]}))
vi.mock('@/lib/prisma',()=>({default:m.db}))
import { getRecoltesAnneeAggregat } from '../recoltes-annee'
const espece={id:'radis',couleur:null,rendement:2,uniteRendement:'kg_m2'}
const culture=(date:Date|null)=>({especeId:'radis',espece,plancheId:'p1',planche:{surface:10,largeur:1,longueur:10},longueur:10,dateRecolte:date})
beforeEach(()=>{
  m.cultures=[];m.recoltes=[]
  Object.assign(m.db,{culture:{findMany:async()=>m.cultures},recolte:{findMany:async()=>m.recoltes},userStockEspece:{findMany:async()=>[]}})
})
it('sans date, la projection totale et la somme par espece restent coherentes',async()=>{
  m.cultures=[culture(null)]
  const r=await getRecoltesAnneeAggregat('u1',2026)
  expect(r.parEspece.reduce((s,e)=>s+e.projectionKg,0)).toBe(r.projectionKg)
})
it('la projection 2026 ne range pas une recolte du 15 janvier 2027 en janvier 2026',async()=>{
  m.cultures=[culture(new Date('2027-01-15T00:00:00Z'))]
  const r=await getRecoltesAnneeAggregat('u1',2026)
  expect(r.parMois[0].projectionKg).toBe(0)
})
it('recolte reelle, projection et leurs ventilations conservent le meme total',async()=>{
  m.cultures=[culture(new Date('2026-06-15T00:00:00Z'))]
  m.recoltes=[{especeId:'radis',espece,quantite:3,unite:'kg',date:new Date('2026-06-01T00:00:00Z')},{especeId:'fleur',espece:{couleur:null},quantite:7,unite:'tige',date:new Date('2026-06-01T00:00:00Z')}]
  const r=await getRecoltesAnneeAggregat('u1',2026)
  expect(r.totalAttenduKg).toBe(23)
  expect(r.totalAttenduParUnite).toEqual({kg:23,tige:7})
  expect(r.parMois.reduce((s,m)=>s+m.realiseesKg+m.projectionKg,0)).toBe(23)
  expect(r.parEspece.reduce((s,e)=>s+e.realiseesKg+e.projectionKg,0)).toBe(23)
})
