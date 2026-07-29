/**
 * Temps d'attente lait — écartement des collectes (review caprin 2026-07-22).
 *
 * Problème corrigé : l'écartement ne franchissait pas la frontière individu↔lot
 * (un soin sur un lot n'écartait pas les collectes individuelles de ses membres,
 * et inversement), et l'écartement/ré-intégration étaient asymétriques (bug
 * introduit puis relevé par la review du 2026-07-21).
 *
 * Approche « recompute-from-truth » : une collecte est écartée SSI un soin actif
 * (fait=true, avec `finAttenteLait`) la couvre — POST/PATCH/DELETE d'un soin, et
 * la saisie d'une collecte, appellent tous `resyncEcartementLait` sur le périmètre
 * concerné. La symétrie est garantie par construction (une seule source de vérité).
 *
 * Couverture d'une collecte C par un soin S (cross-granularité) :
 *   - même animal, ou même lot ;
 *   - S sur un animal dont le lait est collecté au niveau de SON lot ;
 *   - S sur un lot dont un animal membre a une collecte individuelle ;
 * avec la fenêtre au JOUR : jour(S.date) ≤ C.date ≤ S.finAttenteLait
 * (les collectes sont stockées à 00:00 UTC, un soin peut être horodaté).
 */

import { Prisma } from '@prisma/client'

type Db = Prisma.TransactionClient

export function floorDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Cibles de collectes affectées par un soin sur (animalId, lotId), en incluant
 * la frontière individu↔lot : l'animal + son lot, ou le lot + ses animaux membres.
 */
export async function ciblesAffectees(
  db: Db,
  userId: string,
  animalId: number | null,
  lotId: number | null
): Promise<{ animalIds: number[]; lotIds: number[] }> {
  const animalIds = new Set<number>()
  const lotIds = new Set<number>()
  if (animalId != null) {
    animalIds.add(animalId)
    const a = await db.animal.findFirst({ where: { id: animalId, userId }, select: { lotId: true } })
    if (a?.lotId != null) lotIds.add(a.lotId)
  }
  if (lotId != null) {
    lotIds.add(lotId)
    const membres = await db.animal.findMany({ where: { userId, lotId }, select: { id: true } })
    for (const m of membres) animalIds.add(m.id)
  }
  return { animalIds: [...animalIds], lotIds: [...lotIds] }
}

type SoinCouvrant = { date: Date; finAttenteLait: Date | null; animalId: number | null; lotId: number | null }
type CollecteCible = { animalId: number | null; lotId: number | null; date: Date }

/** Un soin couvre-t-il une collecte ? (cible cross-granularité + fenêtre au jour) */
type AppartenanceDatee = { animalId: number; lotId: number; dateDebut: Date; dateFin: Date | null }

function lotALaDate(
  animalId: number,
  date: Date,
  historiques: Map<number, AppartenanceDatee[]>,
  lotCourant: Map<number, number | null>
): number | null {
  const ligne = historiques.get(animalId)?.find(
    (h) => h.dateDebut <= date && (h.dateFin == null || date < h.dateFin)
  )
  // Compatibilité défensive pendant une migration progressive des anciennes
  // données : le lot courant n'est utilisé que si aucun historique n'existe.
  return ligne?.lotId ?? (historiques.has(animalId) ? null : lotCourant.get(animalId) ?? null)
}

function couvre(
  s: SoinCouvrant,
  c: CollecteCible,
  historiques: Map<number, AppartenanceDatee[]>,
  lotCourant: Map<number, number | null>
): boolean {
  if (!s.finAttenteLait) return false
  if (!(floorDayUTC(s.date).getTime() <= c.date.getTime() && c.date.getTime() <= s.finAttenteLait.getTime())) {
    return false
  }
  if (s.animalId != null && c.animalId != null && s.animalId === c.animalId) return true
  if (s.lotId != null && c.lotId != null && s.lotId === c.lotId) return true
  // Soin individuel, collecte au niveau du lot de l'animal traité
  if (s.animalId != null && c.lotId != null && lotALaDate(s.animalId, s.date, historiques, lotCourant) === c.lotId) return true
  // Soin de lot, collecte individuelle d'un animal membre du lot traité
  // Un soin collectif s'applique aux membres présents AU MOMENT DU SOIN : un
  // animal qui quitte ensuite le lot conserve son attente, tandis qu'un animal
  // arrivé après le traitement ne doit pas être écarté à tort.
  if (s.lotId != null && c.animalId != null && lotALaDate(c.animalId, s.date, historiques, lotCourant) === s.lotId) return true
  return false
}

/**
 * Recalcule `ecarteAttente` pour les collectes des cibles données sur la fenêtre
 * [dateMin, dateMax] (bornée au jour). Idempotent : n'écrit que les collectes
 * dont l'état change. Retourne le nombre de collectes modifiées.
 */
export async function resyncEcartementLait(
  db: Db,
  userId: string,
  cibles: { animalIds: number[]; lotIds: number[] },
  dateMin: Date,
  dateMax: Date
): Promise<number> {
  const { animalIds, lotIds } = cibles
  if (animalIds.length === 0 && lotIds.length === 0) return 0

  const orCible: Prisma.CollecteLaitWhereInput[] = []
  if (animalIds.length) orCible.push({ animalId: { in: animalIds } })
  if (lotIds.length) orCible.push({ lotId: { in: lotIds } })

  const debut = floorDayUTC(dateMin)
  const collectes = await db.collecteLait.findMany({
    where: { userId, date: { gte: debut, lte: dateMax }, OR: orCible },
    select: { id: true, date: true, animalId: true, lotId: true, ecarteAttente: true },
  })
  if (collectes.length === 0) return 0

  // Tous les soins actifs dont la fenêtre d'attente lait chevauche [dateMin, dateMax]
  // (peu nombreux sur une ferme). Pas de filtre cible : la couverture cross-
  // granularité est jugée ensuite via la carte d'appartenance.
  // Borne haute à la fin du jour de dateMax : inclut un soin horodaté ce jour-là
  // (le test précis au jour est fait par `couvre`).
  const finJourMax = new Date(floorDayUTC(dateMax).getTime() + 86_400_000)
  const soins = await db.soinAnimal.findMany({
    where: {
      userId,
      fait: true,
      finAttenteLait: { not: null, gte: debut },
      date: { lt: finJourMax },
    },
    select: { date: true, finAttenteLait: true, animalId: true, lotId: true },
  })

  // Carte animal → lot pour tous les animaux référencés (collectes + soins).
  const animalRefs = new Set<number>()
  for (const c of collectes) if (c.animalId != null) animalRefs.add(c.animalId)
  for (const s of soins) if (s.animalId != null) animalRefs.add(s.animalId)
  const lotDe = new Map<number, number | null>()
  const historiques = new Map<number, AppartenanceDatee[]>()
  if (animalRefs.size > 0) {
    const [animaux, affectations] = await Promise.all([
      db.animal.findMany({
        where: { userId, id: { in: [...animalRefs] } },
        select: { id: true, lotId: true },
      }),
      db.$queryRaw<AppartenanceDatee[]>(Prisma.sql`
        SELECT "animal_id" AS "animalId", "lot_id" AS "lotId",
               "date_debut" AS "dateDebut", "date_fin" AS "dateFin"
        FROM "historique_lots_animaux"
        WHERE "user_id" = ${userId}
          AND "animal_id" IN (${Prisma.join([...animalRefs])})
          AND "date_debut" <= ${dateMax}
          AND ("date_fin" IS NULL OR "date_fin" > ${debut})
        ORDER BY "date_debut" DESC
      `),
    ])
    for (const a of animaux) lotDe.set(a.id, a.lotId)
    for (const h of affectations) {
      const lignes = historiques.get(h.animalId) ?? []
      lignes.push(h)
      historiques.set(h.animalId, lignes)
    }
  }

  const aEcarter: string[] = []
  const aReintegrer: string[] = []
  for (const c of collectes) {
    const doitEtreEcartee = soins.some((s) => couvre(s, c, historiques, lotDe))
    if (doitEtreEcartee && !c.ecarteAttente) aEcarter.push(c.id)
    else if (!doitEtreEcartee && c.ecarteAttente) aReintegrer.push(c.id)
  }
  if (aEcarter.length) await db.collecteLait.updateMany({ where: { id: { in: aEcarter } }, data: { ecarteAttente: true } })
  if (aReintegrer.length) await db.collecteLait.updateMany({ where: { id: { in: aReintegrer } }, data: { ecarteAttente: false } })
  return aEcarter.length + aReintegrer.length
}

type SoinCouvrant2 = { finAttenteLait: Date | null; produit: string | null; type: string }

export type CauseAttenteCollecte = {
  traitement: string
  motif: string | null
  finAttenteLait: Date
}

type CollectePourCause = CollecteCible & { id: string; ecarteAttente: boolean }

/**
 * Explique en une requête groupée pourquoi les collectes affichées sont
 * écartées. Le booléen `ecarteAttente` reste persistant ; le motif est relu
 * depuis le soin source, qui demeure la vérité réglementaire. Une collecte
 * écartée manuellement n'a simplement pas de cause automatique associée.
 */
export async function causesAttenteCollectes(
  db: Db,
  userId: string,
  collectes: CollectePourCause[]
): Promise<Map<string, CauseAttenteCollecte>> {
  const concernees = collectes.filter((collecte) => collecte.ecarteAttente)
  const result = new Map<string, CauseAttenteCollecte>()
  if (concernees.length === 0) return result

  const dates = concernees.map((collecte) => floorDayUTC(collecte.date).getTime())
  const debut = new Date(Math.min(...dates))
  const fin = new Date(Math.max(...dates))
  const finJour = new Date(fin.getTime() + 86_400_000)
  const soins = await db.soinAnimal.findMany({
    where: {
      userId,
      fait: true,
      finAttenteLait: { not: null, gte: debut },
      date: { lt: finJour },
    },
    select: {
      date: true,
      finAttenteLait: true,
      animalId: true,
      lotId: true,
      produit: true,
      type: true,
      description: true,
      motif: true,
    },
  })
  if (soins.length === 0) return result

  // En cas de traitements qui se chevauchent, le délai le plus contraignant
  // (fin la plus lointaine) explique la date de libération effective.
  soins.sort((a, b) =>
    (b.finAttenteLait?.getTime() ?? 0) - (a.finAttenteLait?.getTime() ?? 0)
    || b.date.getTime() - a.date.getTime()
  )

  const refs = new Set<number>()
  for (const collecte of concernees) if (collecte.animalId != null) refs.add(collecte.animalId)
  for (const soin of soins) if (soin.animalId != null) refs.add(soin.animalId)
  const lotCourant = new Map<number, number | null>()
  const historiques = new Map<number, AppartenanceDatee[]>()
  if (refs.size > 0) {
    const debutHistorique = new Date(Math.min(debut.getTime(), ...soins.map((soin) => soin.date.getTime())))
    const [animaux, affectations] = await Promise.all([
      db.animal.findMany({
        where: { userId, id: { in: [...refs] } },
        select: { id: true, lotId: true },
      }),
      db.$queryRaw<AppartenanceDatee[]>(Prisma.sql`
        SELECT "animal_id" AS "animalId", "lot_id" AS "lotId",
               "date_debut" AS "dateDebut", "date_fin" AS "dateFin"
        FROM "historique_lots_animaux"
        WHERE "user_id" = ${userId}
          AND "animal_id" IN (${Prisma.join([...refs])})
          AND "date_debut" < ${finJour}
          AND ("date_fin" IS NULL OR "date_fin" > ${debutHistorique})
        ORDER BY "date_debut" DESC
      `),
    ])
    for (const animal of animaux) lotCourant.set(animal.id, animal.lotId)
    for (const affectation of affectations) {
      const lignes = historiques.get(affectation.animalId) ?? []
      lignes.push(affectation)
      historiques.set(affectation.animalId, lignes)
    }
  }

  for (const collecte of concernees) {
    const cible = { ...collecte, date: floorDayUTC(collecte.date) }
    const soin = soins.find((item) => couvre(item, cible, historiques, lotCourant))
    if (!soin?.finAttenteLait) continue
    const traitement = soin.produit || soin.description || soin.type
    result.set(collecte.id, {
      traitement,
      motif: soin.motif || (soin.description && soin.description !== traitement ? soin.description : null),
      finAttenteLait: soin.finAttenteLait,
    })
  }
  return result
}

/**
 * Retourne le soin actif COUVRANT une collecte (animalId/lotId, date) à sa
 * saisie — cross-granularité (même animal/lot, OU animal↔son lot) + comparaison
 * au jour — ou null. Sert au POST/PATCH de collecte pour décider `ecarteAttente`
 * et afficher le traitement en cause.
 */
export async function soinCouvrantCollecte(
  db: Db,
  userId: string,
  animalId: number | null,
  lotId: number | null,
  date: Date
): Promise<SoinCouvrant2 | null> {
  const jour = floorDayUTC(date)
  // Borne haute = fin du jour de la collecte : un soin fait le jour même (mais
  // horodaté après 00:00) doit être inclus (sinon desync « lait du jour »). Le
  // test précis (jour) est fait par `couvre`.
  const finJour = new Date(jour.getTime() + 86_400_000)
  const soins = await db.soinAnimal.findMany({
    where: {
      userId,
      fait: true,
      finAttenteLait: { not: null, gte: jour },
      date: { lt: finJour },
    },
    select: { date: true, finAttenteLait: true, animalId: true, lotId: true, produit: true, type: true },
  })
  if (soins.length === 0) return null
  const refs = new Set<number>()
  if (animalId != null) refs.add(animalId)
  for (const s of soins) if (s.animalId != null) refs.add(s.animalId)
  const lotDe = new Map<number, number | null>()
  const historiques = new Map<number, AppartenanceDatee[]>()
  if (refs.size > 0) {
    const [animaux, affectations] = await Promise.all([
      db.animal.findMany({ where: { userId, id: { in: [...refs] } }, select: { id: true, lotId: true } }),
      db.$queryRaw<AppartenanceDatee[]>(Prisma.sql`
        SELECT "animal_id" AS "animalId", "lot_id" AS "lotId",
               "date_debut" AS "dateDebut", "date_fin" AS "dateFin"
        FROM "historique_lots_animaux"
        WHERE "user_id" = ${userId}
          AND "animal_id" IN (${Prisma.join([...refs])})
          AND "date_debut" < ${finJour}
          AND ("date_fin" IS NULL OR "date_fin" > ${jour})
        ORDER BY "date_debut" DESC
      `),
    ])
    for (const a of animaux) lotDe.set(a.id, a.lotId)
    for (const h of affectations) {
      const lignes = historiques.get(h.animalId) ?? []
      lignes.push(h)
      historiques.set(h.animalId, lignes)
    }
  }
  const c: CollecteCible = { animalId, lotId, date: jour }
  const couvrant = soins.find((s) => couvre(s, c, historiques, lotDe))
  return couvrant ? { finAttenteLait: couvrant.finAttenteLait, produit: couvrant.produit, type: couvrant.type } : null
}
