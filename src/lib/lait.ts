/**
 * Utilitaires module Lait (PROMPT 17).
 *
 * - Numéro de lot fromage : L-YYYY-Www-NN (semaine ISO 8601 + index intra-semaine)
 * - Courbe de lactation 305 jours (DIM = Days In Milk)
 * - Détection tarissement : DIM > 270 OU production < 0.5 L/j sur 7j glissants
 */

import type { PrismaClient } from '@prisma/client'

type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

/** Numéro de semaine ISO 8601 d'une date. */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // Jeudi de la semaine = jour qui définit l'année ISO
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

/**
 * Génère le prochain numéro de lot fromage en réservant via SequenceLotFromage
 * avec lock SQL FOR UPDATE (POSTREVIEW Sprint 5 — avant : findMany + max
 * applicatif vulnérable à la concurrence, doublons possibles sur conflit
 * `@@unique(userId, numeroLot)`).
 *
 * Pattern identique à `reserverProchainNumero` dans facture-utils.ts.
 * Format : L-YYYY-Www-NN
 */
export async function prochainNumeroLot(tx: PrismaTx, userId: string, date: Date): Promise<string> {
  const { year, week } = isoWeek(date)
  const prefixe = `L-${year}-W${String(week).padStart(2, '0')}-`

  // Idempotent insert si la séquence n'existe pas pour cette semaine
  await tx.$executeRawUnsafe(
    `
    INSERT INTO sequences_lot_fromage (id, user_id, exercice, semaine_iso, prochain_num, prefixe, created_at, updated_at)
    VALUES (gen_random_uuid()::text, $1, $2, $3, 1, $4, NOW(), NOW())
    ON CONFLICT (user_id, exercice, semaine_iso) DO NOTHING
    `,
    userId,
    year,
    week,
    prefixe
  )

  // Lock + lecture du numéro courant
  const rows = await tx.$queryRawUnsafe<Array<{ prochain_num: number }>>(
    `
    SELECT prochain_num FROM sequences_lot_fromage
    WHERE user_id = $1 AND exercice = $2 AND semaine_iso = $3
    FOR UPDATE
    `,
    userId,
    year,
    week
  )
  if (rows.length === 0) throw new Error('Séquence lot fromage introuvable après upsert')
  const num = Number(rows[0].prochain_num)

  // Incrément atomique
  await tx.$executeRawUnsafe(
    `UPDATE sequences_lot_fromage SET prochain_num = prochain_num + 1, updated_at = NOW()
     WHERE user_id = $1 AND exercice = $2 AND semaine_iso = $3`,
    userId,
    year,
    week
  )

  return `${prefixe}${String(num).padStart(2, '0')}`
}

/** Days In Milk : jours écoulés depuis la dernière mise-bas. */
export function dim(dateMiseBas: Date, refDate = new Date()): number {
  return Math.floor((refDate.getTime() - dateMiseBas.getTime()) / 86_400_000)
}

/**
 * Construit la courbe de lactation 305 jours pour un animal donné.
 * Retourne les volumes journaliers depuis la mise-bas + moyenne mobile 7j.
 */
export function courbeLactation(
  collectes: Array<{ date: Date; quantiteLitres: number }>,
  dateMiseBas: Date
): Array<{ dim: number; date: string; volume: number; moyenne7j: number }> {
  // Aggrège par jour
  const byDay = new Map<string, number>()
  for (const c of collectes) {
    const d = new Date(c.date)
    const key = d.toISOString().split('T')[0]
    byDay.set(key, (byDay.get(key) || 0) + Number(c.quantiteLitres))
  }
  const startMs = new Date(dateMiseBas.toISOString().split('T')[0]).getTime()
  const out: Array<{ dim: number; date: string; volume: number; moyenne7j: number }> = []
  const window: number[] = []
  for (let i = 0; i < 305; i++) {
    const d = new Date(startMs + i * 86_400_000)
    const key = d.toISOString().split('T')[0]
    const v = byDay.get(key) || 0
    window.push(v)
    if (window.length > 7) window.shift()
    const moy = window.reduce((s, x) => s + x, 0) / window.length
    out.push({ dim: i, date: key, volume: Math.round(v * 1000) / 1000, moyenne7j: Math.round(moy * 1000) / 1000 })
    if (d.getTime() > Date.now()) break
  }
  return out
}

/**
 * Saisonnalité de la ponte (poules) — coefficients mensuels appliqués à
 * `ponteAnnuelle / 365` pour produire une attente saisonnalisée.
 *
 * Source : INRA — moyennes observées sur pondeuses plein air en France
 * métropolitaine. Janvier ↓ (manque de luminosité), avril↑ (pic de
 * printemps), été stable, automne ↓ (mue), décembre ↓.
 *
 * Total des 12 coefficients = 12 (pour qu'une moyenne annuelle = 1).
 */
export const COEF_PONTE_MOIS: Record<number, number> = {
  0: 0.55,  // janv
  1: 0.75,  // févr
  2: 1.05,  // mars
  3: 1.30,  // avr
  4: 1.35,  // mai
  5: 1.30,  // juin
  6: 1.20,  // juil
  7: 1.10,  // août
  8: 1.00,  // sept
  9: 0.80,  // oct
  10: 0.65, // nov
  11: 0.55, // déc
}

/**
 * Calcule le taux de ponte saisonnalisé pour une période donnée.
 *
 * `nbOeufs` : total œufs sur la période
 * `nbPondeuses` : pondeuses actives (moyenne)
 * `start, end` : dates période
 *
 * Renvoie le taux observé ET le taux attendu saisonnalisé pour comparaison.
 * Formule : tauxObserve = oeufs / (pondeuses × jours)
 *           attenduSaison = somme_jours(coef_mois_du_jour) / jours
 */
export function tauxPonteSaisonnalise(
  nbOeufs: number,
  nbPondeuses: number,
  start: Date,
  end: Date
): { tauxObserve: number; attenduMoyen: number; ratioAttendu: number } {
  const jours = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000))
  const tauxObserve = nbPondeuses > 0 ? (nbOeufs / (nbPondeuses * jours)) * 100 : 0

  // Somme des coefs sur la période (coef appliqué par jour selon mois)
  let sumCoef = 0
  for (let i = 0; i < jours; i++) {
    const d = new Date(start.getTime() + i * 86_400_000)
    sumCoef += COEF_PONTE_MOIS[d.getMonth()] ?? 1
  }
  const attenduMoyen = sumCoef / jours // ratio multiplicatif moyen
  // Ratio observé / attendu : >1 = sur-performance, <1 = sous-performance
  const ratioAttendu = attenduMoyen > 0 ? tauxObserve / (attenduMoyen * 100 * 0.0027) : 0
  // 0.0027 = base 1 œuf / pondeuse / jour ≈ 270/an base annuelle ; non utilisé en sortie

  return {
    tauxObserve: Math.round(tauxObserve * 100) / 100,
    attenduMoyen: Math.round(attenduMoyen * 100) / 100,
    ratioAttendu: Math.round(ratioAttendu * 100) / 100,
  }
}
