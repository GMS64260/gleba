import type { Prisma } from '@prisma/client'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'
import { ErreurVerger } from './erreur'

type Db = Pick<Prisma.TransactionClient, 'parcelleGeo' | 'zoneVerger' | 'productionBois' | 'espece' | 'porteGreffe'>

export async function verifierReferencesCampagne(db: Db, userId: string, saisie: Record<string, unknown>) {
  const entier = (champ: 'zoneVergerId' | 'productionBoisId') => {
    const v = saisie[champ]
    const n = Number(v)
    if ((typeof v !== 'number' && (typeof v !== 'string' || !/^[1-9]\d*$/.test(v))) || !Number.isSafeInteger(n) || n <= 0 || n > 2_147_483_647) throw new ErreurVerger('Identifiant invalide.', 400, champ)
    return n
  }
  for (const champ of ['parcelleGeoId', 'especeId', 'porteGreffeId']) {
    if (saisie[champ] != null && typeof saisie[champ] !== 'string') throw new ErreurVerger('Identifiant invalide.', 400, champ)
  }
  const controles = [
    ['parcelleGeoId', () => db.parcelleGeo.findFirst({ where: { id: String(saisie.parcelleGeoId), userId }, select: { id: true } })],
    ['zoneVergerId', () => db.zoneVerger.findFirst({ where: { id: entier('zoneVergerId'), userId }, select: { id: true } })],
    ['productionBoisId', () => db.productionBois.findFirst({ where: { id: entier('productionBoisId'), userId }, select: { id: true } })],
    ['especeId', () => db.espece.findFirst({ where: { id: String(saisie.especeId), ...visibiliteReferentiel(userId) }, select: { id: true } })],
    ['porteGreffeId', () => db.porteGreffe.findFirst({ where: { id: String(saisie.porteGreffeId), ...visibiliteReferentiel(userId) }, select: { id: true } })],
  ] as const
  for (const [champ, lire] of controles) {
    if (saisie[champ] != null && saisie[champ] !== '' && !await lire()) throw new ErreurVerger('Référence introuvable dans votre exploitation.', 400, champ)
  }
}

type References = { parcelleGeoId: string | null; zoneVergerId: number | null; productionBoisId: number | null; especeId: string | null; porteGreffeId: string | null }
type ReferencesMasquees<T> = { [K in keyof T]: K extends 'parcelleGeo' | 'zoneVerger' | 'productionBois' | 'espece' | 'porteGreffe' ? T[K] | null : T[K] }

/** Protège aussi les anciennes références, ou un référentiel repassé privé. */
export async function masquerReferencesCampagnes<T extends References>(db: Db, userId: string, lignes: T[]): Promise<ReferencesMasquees<T>[]> {
  const parcelles = lignes.flatMap(c => c.parcelleGeoId ? [c.parcelleGeoId] : [])
  const zones = lignes.flatMap(c => c.zoneVergerId ? [c.zoneVergerId] : [])
  const bois = lignes.flatMap(c => c.productionBoisId ? [c.productionBoisId] : [])
  const especes = lignes.flatMap(c => c.especeId ? [c.especeId] : [])
  const greffes = lignes.flatMap(c => c.porteGreffeId ? [c.porteGreffeId] : [])
  const [p, z, b, e, g] = await Promise.all([
    parcelles.length ? db.parcelleGeo.findMany({ where: { userId, id: { in: parcelles } }, select: { id: true } }) : [],
    zones.length ? db.zoneVerger.findMany({ where: { userId, id: { in: zones } }, select: { id: true } }) : [],
    bois.length ? db.productionBois.findMany({ where: { userId, id: { in: bois } }, select: { id: true } }) : [],
    especes.length ? db.espece.findMany({ where: { id: { in: especes }, ...visibiliteReferentiel(userId) }, select: { id: true } }) : [],
    greffes.length ? db.porteGreffe.findMany({ where: { id: { in: greffes }, ...visibiliteReferentiel(userId) }, select: { id: true } }) : [],
  ])
  const visibles = { p: new Set(p.map(x => x.id)), z: new Set(z.map(x => x.id)), b: new Set(b.map(x => x.id)), e: new Set(e.map(x => x.id)), g: new Set(g.map(x => x.id)) }
  return lignes.map(c => ({ ...c,
    ...(c.parcelleGeoId && !visibles.p.has(c.parcelleGeoId) ? { parcelleGeoId: null, parcelleGeo: null } : {}),
    ...(c.zoneVergerId && !visibles.z.has(c.zoneVergerId) ? { zoneVergerId: null, zoneVerger: null } : {}),
    ...(c.productionBoisId && !visibles.b.has(c.productionBoisId) ? { productionBoisId: null, productionBois: null } : {}),
    ...(c.especeId && !visibles.e.has(c.especeId) ? { especeId: null, espece: null } : {}),
    ...(c.porteGreffeId && !visibles.g.has(c.porteGreffeId) ? { porteGreffeId: null, porteGreffe: null } : {}),
  })) as ReferencesMasquees<T>[]
}
