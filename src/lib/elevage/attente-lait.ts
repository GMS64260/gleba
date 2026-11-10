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
import { jourCivilStocke } from '@/lib/jour-civil'

type Db = Prisma.TransactionClient

export function floorDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

const MS_JOUR = 86_400_000

/**
 * Minuit UTC du JOUR CIVIL d'un soin ou d'une fin d'attente, la forme sous
 * laquelle une collecte est stockée. Une date sans heure est déjà ce jour ; une
 * date horodatée se lit au fuseau du processus (Europe/Paris en production),
 * pas en UTC : une injection du 2 à 00:30 à Paris est stockée le 1er à 23:30
 * UTC. Lue en UTC, elle écartait à tort le lait du 1er et libérait celui du
 * dernier jour d'attente un jour trop tôt.
 */
export function jourCivilAttente(d: Date): Date {
  const jour = jourCivilStocke(d)
  return jour ? new Date(`${jour}T00:00:00.000Z`) : floorDayUTC(d)
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

/**
 * Cibles de COLLECTES DE LAIT à recalculer pour un soin : celles de
 * `ciblesAffectees`, plus les appartenances passées. Un animal sorti du lot
 * traité garde son attente, et le lait d'un animal traité part dans le tank du
 * lot où il se trouve le jour de la collecte. Le périmètre est volontairement
 * large : `resyncEcartementLait` recalcule depuis la vérité, une cible en trop
 * ne change rien.
 */
export async function ciblesLaitAffectees(
  db: Db,
  userId: string,
  animalId: number | null,
  lotId: number | null
): Promise<{ animalIds: number[]; lotIds: number[] }> {
  const actuelles = await ciblesAffectees(db, userId, animalId, lotId)
  const animalIds = new Set(actuelles.animalIds)
  const lotIds = new Set(actuelles.lotIds)
  const passees = await chargerAppartenances(db, userId, actuelles.animalIds, actuelles.lotIds)
  for (const lignes of passees.values()) {
    for (const h of lignes) {
      animalIds.add(h.animalId)
      lotIds.add(h.lotId)
    }
  }
  return { animalIds: [...animalIds], lotIds: [...lotIds] }
}

type SoinCouvrant = { date: Date; finAttenteLait: Date | null; animalId: number | null; lotId: number | null }
type CollecteCible = { animalId: number | null; lotId: number | null; date: Date }

/** Un soin couvre-t-il une collecte ? (cible cross-granularité + fenêtre au jour) */
export type AppartenanceDatee = { animalId: number; lotId: number; dateDebut: Date; dateFin: Date | null }

export function lotALaDate(
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

/**
 * Lots où l'animal s'est trouvé à un moment du jour civil `jour` (minuit UTC) :
 * un changement de lot en cours de journée compte pour les deux lots.
 */
export function lotsDurantJour(
  animalId: number,
  jour: Date,
  historiques: Map<number, AppartenanceDatee[]>,
  lotCourant: Map<number, number | null>
): number[] {
  const lignes = historiques.get(animalId)
  if (!lignes) {
    const lot = lotCourant.get(animalId)
    return lot != null ? [lot] : []
  }
  const fin = jour.getTime() + MS_JOUR
  return lignes
    .filter((h) => h.dateDebut.getTime() < fin && (h.dateFin == null || h.dateFin.getTime() > jour.getTime()))
    .map((h) => h.lotId)
}

function couvre(
  s: SoinCouvrant,
  c: CollecteCible,
  historiques: Map<number, AppartenanceDatee[]>,
  lotCourant: Map<number, number | null>
): boolean {
  if (!s.finAttenteLait) return false
  const jourCollecte = c.date.getTime()
  if (!(jourCivilAttente(s.date).getTime() <= jourCollecte && jourCollecte <= jourCivilAttente(s.finAttenteLait).getTime())) {
    return false
  }
  if (s.animalId != null && c.animalId != null && s.animalId === c.animalId) return true
  if (s.lotId != null && c.lotId != null && s.lotId === c.lotId) return true
  // Soin individuel, collecte de lot : le lait de l'animal traité part dans le
  // tank du lot où il se trouve LE JOUR DE LA COLLECTE. Lire son lot à la date
  // du soin laissait passer le tank de son nouveau lot et écartait à tort
  // celui de l'ancien.
  if (s.animalId != null && c.lotId != null && lotsDurantJour(s.animalId, c.date, historiques, lotCourant).includes(c.lotId)) return true
  // Soin de lot, collecte individuelle d'un animal membre du lot traité
  // Un soin collectif s'applique aux membres présents AU MOMENT DU SOIN : un
  // animal qui quitte ensuite le lot conserve son attente, tandis qu'un animal
  // arrivé après le traitement ne doit pas être écarté à tort.
  if (s.lotId != null && c.animalId != null && lotALaDate(c.animalId, s.date, historiques, lotCourant) === s.lotId) return true
  // Soin de lot, collecte d'un AUTRE lot : un animal traité avec son lot puis
  // déplacé apporte son lait au tank du lot d'arrivée.
  if (s.lotId != null && c.lotId != null) {
    for (const [animalId, lignes] of historiques) {
      const traite = lignes.some(
        (h) => h.lotId === s.lotId && h.dateDebut <= s.date && (h.dateFin == null || s.date < h.dateFin)
      )
      if (traite && lotsDurantJour(animalId, c.date, historiques, lotCourant).includes(c.lotId)) return true
    }
  }
  return false
}

/**
 * Historique COMPLET d'appartenance des animaux donnés et de tout animal passé
 * par les lots donnés, par animal, du plus récent au plus ancien.
 *
 * Aucune borne de date : l'appartenance se lit à la date du SOIN, qui précède
 * la fenêtre des collectes. Bornée à cette fenêtre, la lecture perdait la
 * ligne du lot traité dès que l'animal en était sorti : ses collectes
 * n'étaient plus écartées. Un animal a une poignée de lignes.
 */
export async function chargerAppartenances(
  db: Db,
  userId: string,
  animalIds: number[],
  lotIds: number[]
): Promise<Map<number, AppartenanceDatee[]>> {
  const ids = new Set(animalIds)
  if (lotIds.length > 0) {
    const passes = await db.$queryRaw<{ animalId: number }[]>(Prisma.sql`
      SELECT DISTINCT "animal_id" AS "animalId"
      FROM "historique_lots_animaux"
      WHERE "user_id" = ${userId}
        AND "lot_id" IN (${Prisma.join(lotIds)})
    `)
    for (const ligne of passes ?? []) ids.add(ligne.animalId)
  }
  const historiques = new Map<number, AppartenanceDatee[]>()
  if (ids.size === 0) return historiques
  const affectations = await db.$queryRaw<AppartenanceDatee[]>(Prisma.sql`
    SELECT "animal_id" AS "animalId", "lot_id" AS "lotId",
           "date_debut" AS "dateDebut", "date_fin" AS "dateFin"
    FROM "historique_lots_animaux"
    WHERE "user_id" = ${userId}
      AND "animal_id" IN (${Prisma.join([...ids])})
    ORDER BY "date_debut" DESC
  `)
  for (const h of affectations ?? []) {
    if (h?.lotId == null || h.animalId == null) continue
    const lignes = historiques.get(h.animalId) ?? []
    lignes.push(h)
    historiques.set(h.animalId, lignes)
  }
  return historiques
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
  // Les deux bornes de ce préfiltre gardent un jour de marge : une fin d'attente
  // horodatée la veille au soir en UTC tombe le lendemain en jour civil.
  const finJourMax = new Date(floorDayUTC(dateMax).getTime() + 86_400_000)
  const soins = await db.soinAnimal.findMany({
    where: {
      userId,
      fait: true,
      finAttenteLait: { not: null, gte: new Date(debut.getTime() - MS_JOUR) },
      date: { lt: finJourMax },
    },
    select: { date: true, finAttenteLait: true, animalId: true, lotId: true },
  })

  // Carte animal → lot pour tous les animaux référencés (collectes + soins).
  const animalRefs = new Set<number>()
  for (const c of collectes) if (c.animalId != null) animalRefs.add(c.animalId)
  for (const s of soins) if (s.animalId != null) animalRefs.add(s.animalId)
  const lotDe = new Map<number, number | null>()
  const lotsRefs = new Set<number>()
  for (const c of collectes) if (c.lotId != null) lotsRefs.add(c.lotId)
  for (const s of soins) if (s.lotId != null) lotsRefs.add(s.lotId)
  const historiques = await chargerAppartenances(db, userId, [...animalRefs], [...lotsRefs])
  if (animalRefs.size > 0) {
    const animaux = await db.animal.findMany({
      where: { userId, id: { in: [...animalRefs] } },
      select: { id: true, lotId: true },
    })
    for (const a of animaux) lotDe.set(a.id, a.lotId)
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
      finAttenteLait: { not: null, gte: new Date(debut.getTime() - MS_JOUR) },
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
  const lotsRefs = new Set<number>()
  for (const collecte of concernees) if (collecte.lotId != null) lotsRefs.add(collecte.lotId)
  for (const soin of soins) if (soin.lotId != null) lotsRefs.add(soin.lotId)
  const historiques = await chargerAppartenances(db, userId, [...refs], [...lotsRefs])
  if (refs.size > 0) {
    const animaux = await db.animal.findMany({
      where: { userId, id: { in: [...refs] } },
      select: { id: true, lotId: true },
    })
    for (const animal of animaux) lotCourant.set(animal.id, animal.lotId)
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
      finAttenteLait: { not: null, gte: new Date(jour.getTime() - MS_JOUR) },
      date: { lt: finJour },
    },
    select: { date: true, finAttenteLait: true, animalId: true, lotId: true, produit: true, type: true },
  })
  if (soins.length === 0) return null
  const refs = new Set<number>()
  if (animalId != null) refs.add(animalId)
  for (const s of soins) if (s.animalId != null) refs.add(s.animalId)
  const lotDe = new Map<number, number | null>()
  const lotsRefs = new Set<number>()
  if (lotId != null) lotsRefs.add(lotId)
  for (const s of soins) if (s.lotId != null) lotsRefs.add(s.lotId)
  const historiques = await chargerAppartenances(db, userId, [...refs], [...lotsRefs])
  if (refs.size > 0) {
    const animaux = await db.animal.findMany({ where: { userId, id: { in: [...refs] } }, select: { id: true, lotId: true } })
    for (const a of animaux) lotDe.set(a.id, a.lotId)
  }
  const c: CollecteCible = { animalId, lotId, date: jour }
  const couvrant = soins.find((s) => couvre(s, c, historiques, lotDe))
  return couvrant ? { finAttenteLait: couvrant.finAttenteLait, produit: couvrant.produit, type: couvrant.type } : null
}
