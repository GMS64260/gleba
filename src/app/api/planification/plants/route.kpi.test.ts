import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const m=vi.hoisted(()=>({ besoins:vi.fn() }))
vi.mock('@/lib/auth-utils',()=>({ requireAuthApi:async()=>({error:null,session:{user:{id:'u1'}}}),getUserId:(s:{user:{id:string}})=>s.user.id }))
vi.mock('@/lib/planification',()=>({getBesoinsPlants:m.besoins}))
vi.mock('@/lib/prisma',()=>({default:{espece:{findMany:async()=>[{id:'poireau',nom:'Poireau'}]},variete:{findMany:async()=>[{id:'v1',nom:'Variété 1'},{id:'v2',nom:'Variété 2'}]}}}))
import { GET } from './route'
beforeEach(()=>vi.clearAllMocks())
it('les cartes comptent les espèces distinctes malgré les successions et les variétés',async()=>{
  m.besoins.mockResolvedValue([
    { especeId:'poireau',varieteId:'v1',semainePlantation:20,nbPlants:100,stockActuel:0,aCommander:110,cultures:[{plancheId:'A1',surface:10,nbPlants:100}] },
    { especeId:'poireau',varieteId:'v2',semainePlantation:22,nbPlants:50,stockActuel:0,aCommander:55,cultures:[{plancheId:'A2',surface:5,nbPlants:50}] },
  ])
  const res=await GET(new NextRequest('http://localhost/api/planification/plants?annee=2026'))
  const {stats}=await res.json()
  expect(res.status).toBe(200)
  expect(stats).toMatchObject({nbEspeces:1,especesSansStock:1,totalPlants:150,totalCultures:2,totalACommander:165,parSemaine:{20:100,22:50}})
})
