import { beforeEach, expect, it, vi } from 'vitest'
type CultureTemoin = Omit<ReturnType<typeof culture>, 'itp' | 'itpId'> & { itp: typeof itps[number] | null | undefined; itpId: string | null | undefined }
const m = vi.hoisted(() => ({ db: {} as Record<string, { findMany: ReturnType<typeof vi.fn> }>, cultures: [] as CultureTemoin[] }))
vi.mock('@/lib/prisma', () => ({ default: m.db }))
vi.mock('@/lib/terroir', async (original) => ({ ...(await original<typeof import('@/lib/terroir')>()), zoneEffectiveUser: vi.fn(async () => null) }))
import { getBesoinsSemences, getRecoltesPrevuesDetail } from '@/lib/planification'
const espece = { id: 'Radis', nom: 'Radis', userId: null, couleur: null, modeSemis: 'graine_directe', doseSemis: 2, uniteDose: 'g_m2', tauxGermination: 100, margeSecuritePct: 0, densite: 100, rendement: 2, uniteRendement: 'kg_m2', famille: null }
const itps = [1, 3].map((dose, i) => ({ id: `itp-${i}`, especeId: 'Radis', userId: null, actif: true, zoneClimat: null, doseSemis: dose, nbGrainesPlant: null, nbRangs: 1, espacement: 10, semaineSemis: 10, semainePlantation: null, semaineRecolte: 20 }))
const culture = (id: number) => ({ id, userId: 'moi', annee: 2026, especeId: 'Radis', espece, varieteId: 'radis-var', variete: null, itpId: itps[id-1]?.id, itp: itps[id-1], plancheId: `p${id}`, planche: { id: `p${id}`, nom: `P${id}`, largeur: 1, longueur: 10, surface: 10, ilot: null, rotationId: null }, longueur: 10, quantite: 100, nbRangs: 1, espacement: 10, dateSemis: new Date('2026-03-01T00:00:00Z'), datePlantation: null, dateRecolte: new Date('2026-05-01T00:00:00Z'), recolteFaite: false, terminee: null })
beforeEach(() => {
  vi.clearAllMocks()
  m.cultures = [culture(1), culture(2)]
  Object.assign(m.db, {
    planche: { findMany: vi.fn(async () => []) },
    culture: { findMany: vi.fn(async () => m.cultures) },
    espece: { findMany: vi.fn(async () => [espece]) },
    variete: { findMany: vi.fn(async () => [{ id: 'radis-var', especeId: 'Radis', nbGrainesG: 100 }]) },
    userStockVariete: { findMany: vi.fn(async () => []) },
    userStockEspece: { findMany: vi.fn(async () => []) },
    iTP: { findMany: vi.fn(async () => itps) },
  })
})
it('cumule les doses ITP de chaque culture sans dependre de leur ordre', async () => {
  const [a] = await getBesoinsSemences('moi', 2026)
  expect(a.surfaceTotale).toBe(20)
  expect(a.grainesNecessaires).toBe(40)
  m.cultures.reverse()
  const [b] = await getBesoinsSemences('moi', 2026)
  expect(b.grainesNecessaires).toBe(40)
})
it('inclut la semaine ISO 53 dans les lignes et dans le total annuel', async () => {
  m.cultures = [{ ...culture(1), dateRecolte: new Date('2026-12-30T00:00:00Z') }]
  const r = await getRecoltesPrevuesDetail('moi', 2026, 'semaine')
  expect(r.projectionCreeesKg).toBe(20)
  expect(r.periodes.reduce((s, p) => s + p.totalKg, 0)).toBe(20)
  expect(r.periodes).toHaveLength(53)
  expect(r.periodes[52].totalKg).toBe(20)
})

it('le stock de la variete est soustrait une seule fois pour plusieurs itineraires', async () => {
  m.db.userStockVariete.findMany.mockResolvedValue([{varieteId:'radis-var',stockGraines:10,stockPlants:0,dateStock:null}])
  const [b] = await getBesoinsSemences('moi',2026)
  expect(b).toMatchObject({grainesNecessaires:40,stockActuel:10,aCommander:30,doseMoyenne:true})
})
it('une culture sans ITP garde la dose de l espece, pas celle de sa voisine', async () => {
  m.cultures[1]={...m.cultures[1],itpId:null,itp:null}
  const [b] = await getBesoinsSemences('moi',2026)
  expect(b.grainesNecessaires).toBe(30)
})
it('les graines par plant sont ponderees par les plants, pas par la surface', async () => {
  const avant={...espece}; const i0={...itps[0]}; const i1={...itps[1]}
  try {
    Object.assign(espece,{modeSemis:'plant_repique',uniteDose:'graines_plant'})
    Object.assign(itps[0],{nbGrainesPlant:1});Object.assign(itps[1],{nbGrainesPlant:3})
    const [b] = await getBesoinsSemences('moi',2026)
    expect(b.grainesNecessaires).toBe(4)
  } finally {Object.assign(espece,avant);Object.assign(itps[0],i0);Object.assign(itps[1],i1)}
})
// Revue du 2026-10-29 — une seule culture sans dose annulait le besoin de tout
// son couple espèce + variété (0 g à commander pour les cultures dosées).
it('une culture sans dose n annule plus le besoin des cultures dosees : besoin partiel signale', async () => {
  const avant = { ...espece }
  try {
    Object.assign(espece, { doseSemis: null })
    m.cultures[1] = { ...m.cultures[1], itpId: null, itp: null }
    m.db.userStockVariete.findMany.mockResolvedValue([{ varieteId: 'radis-var', stockGraines: 50, stockPlants: 0, dateStock: null }])
    const [b] = await getBesoinsSemences('moi', 2026)
    // 1 g/m² sur les 10 m² dosés ; le stock couvrirait ce besoin sous-estimé, pas de « OK ».
    expect(b).toMatchObject({ surfaceTotale: 20, grainesNecessaires: 10, aCommander: 0, besoinPartiel: true, statut: 'DONNEE_MANQUANTE', doseSemis: null })
    m.cultures[0] = { ...m.cultures[0], itpId: null, itp: null }
    const [aucune] = await getBesoinsSemences('moi', 2026)
    expect(aucune).toMatchObject({ grainesNecessaires: 0, besoinPartiel: false, statut: 'DONNEE_MANQUANTE' })
  } finally { Object.assign(espece, avant) }
})
