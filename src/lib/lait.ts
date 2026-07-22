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

// ============================================================
// PROMPT 21 — SYNTHÈSE PAR LACTATION & PALMARÈS
// ============================================================

export type CollecteLite = {
  date: Date | string
  quantiteLitres: number
  mg?: number | null
  mp?: number | null
  cellules?: number | null
}
export type MiseBasLite = { date: Date | string }

export type LactationSynthese = {
  /** Numéro d'ordre de la lactation (1 = première). null si origine non connue (pas de mise-bas enregistrée). */
  rang: number | null
  debut: string
  /** Date de la mise-bas suivante (= tarissement/fin), null si lactation en cours. */
  fin: string | null
  enCours: boolean
  /** Jours écoulés depuis la mise-bas (DIM) si en cours, sinon durée de la lactation. */
  jours: number
  /** Lait cumulé sur toute la lactation observée (litres). */
  laitTotal: number
  /**
   * Lait cumulé sur les 305 premiers jours de lactation, litres. NB : c'est le
   * cumul des traites SAISIES dans la fenêtre, pas une lactation standardisée
   * interpolée (à ne pas confondre en contrôle laitier mensuel).
   */
  lait305: number
  nbTraites: number
  /** Moyenne journalière sur les jours réellement couverts par une traite (L/j). */
  moyenneJour: number
  /** Pic de lactation : meilleure moyenne mobile 7 j (L/j). */
  pic: number
  tbMoyen: number | null
  tpMoyen: number | null
  cellulesMoy: number | null
}

const jourISO = (d: Date | string): string => new Date(d).toISOString().split('T')[0]
const msJour = (d: Date | string): number => new Date(jourISO(d)).getTime()

/**
 * Reconstitue les lactations d'une femelle à partir de ses mises-bas et de ses
 * collectes de lait. Chaque mise-bas ouvre une lactation qui se ferme à la
 * mise-bas suivante (ou reste « en cours »). Fournit le lait 305 j standardisé,
 * le pic, la moyenne journalière et les taux moyens — base du palmarès (P21).
 *
 * Si aucune mise-bas n'est connue mais des collectes existent, une lactation de
 * repli est créée depuis la première collecte (rang inconnu).
 */
export function synthetiseLactations(
  miseBas: MiseBasLite[],
  collectes: CollecteLite[],
  refDate: Date = new Date()
): LactationSynthese[] {
  const refMs = msJour(refDate)
  const debuts = [...miseBas]
    .map((m) => msJour(m.date))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)

  // Repli : pas de mise-bas mais des collectes → lactation depuis la 1re collecte
  let rangConnu = true
  if (debuts.length === 0) {
    if (collectes.length === 0) return []
    const premier = Math.min(...collectes.map((c) => msJour(c.date)))
    debuts.push(premier)
    rangConnu = false
  }

  const out: LactationSynthese[] = []
  for (let i = 0; i < debuts.length; i++) {
    const debut = debuts[i]
    const finSuivante = i + 1 < debuts.length ? debuts[i + 1] : null
    // Fenêtre d'observation : jusqu'à la mise-bas suivante (exclue) ou aujourd'hui
    const finObs = finSuivante ?? refMs + 86_400_000
    const enCours = finSuivante === null

    const dansFenetre = collectes.filter((c) => {
      const t = msJour(c.date)
      return t >= debut && t < finObs
    })
    if (dansFenetre.length === 0 && !enCours) continue

    // Agrégation par jour pour pic (moyenne mobile 7 j) et moyenne journalière
    const parJour = new Map<number, number>()
    for (const c of dansFenetre) {
      const t = msJour(c.date)
      parJour.set(t, (parJour.get(t) || 0) + Number(c.quantiteLitres))
    }
    const laitTotal = dansFenetre.reduce((s, c) => s + Number(c.quantiteLitres), 0)
    const fin305 = debut + 305 * 86_400_000
    const lait305 = dansFenetre
      .filter((c) => msJour(c.date) < fin305)
      .reduce((s, c) => s + Number(c.quantiteLitres), 0)

    // Pic : parcours jour par jour de debut à min(finObs, aujourd'hui), moyenne mobile 7 j
    const finPic = Math.min(finObs, refMs + 86_400_000)
    let pic = 0
    const window: number[] = []
    for (let t = debut; t < finPic; t += 86_400_000) {
      window.push(parJour.get(t) || 0)
      if (window.length > 7) window.shift()
      const moy = window.reduce((s, x) => s + x, 0) / window.length
      if (moy > pic) pic = moy
    }

    const joursCouverts = parJour.size
    const moyenneJour = joursCouverts > 0 ? laitTotal / joursCouverts : 0
    const jours = Math.max(0, Math.round((Math.min(finObs, refMs + 86_400_000) - debut) / 86_400_000))

    const moyChamp = (getter: (c: CollecteLite) => number | null | undefined): number | null => {
      const vals = dansFenetre.map(getter).filter((v): v is number => v != null && !Number.isNaN(Number(v))).map(Number)
      return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null
    }
    const tb = moyChamp((c) => c.mg)
    const tp = moyChamp((c) => c.mp)
    const cell = moyChamp((c) => c.cellules)

    out.push({
      rang: rangConnu ? i + 1 : null,
      debut: jourISO(new Date(debut)),
      fin: finSuivante != null ? jourISO(new Date(finSuivante)) : null,
      enCours,
      jours,
      laitTotal: Math.round(laitTotal * 10) / 10,
      lait305: Math.round(lait305 * 10) / 10,
      nbTraites: dansFenetre.length,
      moyenneJour: Math.round(moyenneJour * 100) / 100,
      pic: Math.round(pic * 100) / 100,
      tbMoyen: tb != null ? Math.round(tb * 10) / 10 : null,
      tpMoyen: tp != null ? Math.round(tp * 10) / 10 : null,
      cellulesMoy: cell != null ? Math.round(cell) : null,
    })
  }
  return out
}

// ============================================================
// PROMPT 20 — CELLULES & QUALITÉ DU LAIT (détection mammites)
// ============================================================

/**
 * Seuils de numération cellulaire par filière, en milliers de cellules/mL
 * (×10³/mL — unité de `CollecteLait.cellulesParMl`).
 *
 * La chèvre sécrète son lait par voie apocrine : sa numération cellulaire de
 * base est structurellement plus haute que celle de la vache, sans mammite.
 * Les seuils caprins/ovins sont donc plus tolérants. Repères de conduite de
 * troupeau (mammites subcliniques), non des seuils réglementaires de paie —
 * ceux-ci se gèrent au tank (cf. P26).
 */
export type CategorieCellules = 'caprin' | 'ovin' | 'bovin' | 'default'
export type StatutCellules = 'ok' | 'surveillance' | 'alerte'

export const SEUILS_CELLULES: Record<CategorieCellules, { surveillance: number; alerte: number }> = {
  caprin: { surveillance: 1000, alerte: 1500 },
  ovin: { surveillance: 750, alerte: 1250 },
  bovin: { surveillance: 400, alerte: 800 },
  default: { surveillance: 600, alerte: 1200 },
}

/** Déduit la filière de seuils depuis la catégorie réglementaire de l'espèce. */
export function categorieCellules(categorieReglementaire?: string | null): CategorieCellules {
  const c = (categorieReglementaire || '').toLowerCase()
  if (c.includes('caprin')) return 'caprin'
  // « bovin » contient « ovin » : tester bovin d'abord.
  if (c.includes('bovin')) return 'bovin'
  if (c.includes('ovin')) return 'ovin'
  return 'default'
}

/** Classe une numération cellulaire (×10³/mL) selon les seuils de la filière. */
export function statutCellules(cellules: number | null | undefined, cat: CategorieCellules): StatutCellules {
  if (cellules == null) return 'ok'
  const s = SEUILS_CELLULES[cat]
  if (cellules >= s.alerte) return 'alerte'
  if (cellules >= s.surveillance) return 'surveillance'
  return 'ok'
}

export type MesureQualite = { date: Date | string; cellules?: number | null; mg?: number | null; mp?: number | null }
export type AnalyseQualite = {
  derniere: { date: string; cellules: number | null; mg: number | null; mp: number | null } | null
  moyenneCellules: number | null
  moyenneMg: number | null
  moyenneMp: number | null
  nbMesures: number
  tendance: 'hausse' | 'baisse' | 'stable' | null
  statut: StatutCellules
}

/**
 * Synthèse qualité d'un animal (ou lot) à partir de ses mesures de collecte.
 * - `derniere` : mesure la plus récente disposant d'une numération cellulaire.
 * - `moyenne*` : moyenne des mesures renseignées sur la fenêtre fournie.
 * - `tendance` : dernière numération vs moyenne des précédentes (seuil ±15 %).
 * - `statut` : classement de la dernière numération selon la filière.
 */
export function analyseQualiteLait(mesures: MesureQualite[], cat: CategorieCellules): AnalyseQualite {
  const parCellules = mesures
    .filter((m) => m.cellules != null && !Number.isNaN(Number(m.cellules)))
    .map((m) => ({ ...m, cellules: Number(m.cellules), t: new Date(m.date).getTime() }))
    .sort((a, b) => b.t - a.t)

  const moy = (vals: number[]): number | null =>
    vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length)) : null

  const moyenneCellules = moy(parCellules.map((m) => m.cellules))
  const moyenneMg = (() => {
    const v = mesures.filter((m) => m.mg != null).map((m) => Number(m.mg))
    return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null
  })()
  const moyenneMp = (() => {
    const v = mesures.filter((m) => m.mp != null).map((m) => Number(m.mp))
    return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null
  })()

  if (parCellules.length === 0) {
    return { derniere: null, moyenneCellules, moyenneMg, moyenneMp, nbMesures: 0, tendance: null, statut: 'ok' }
  }

  const d = parCellules[0]
  const derniere = {
    date: new Date(d.date).toISOString().split('T')[0],
    cellules: d.cellules,
    mg: d.mg != null ? Number(d.mg) : null,
    mp: d.mp != null ? Number(d.mp) : null,
  }

  // Tendance : dernière valeur vs moyenne des précédentes (hors dernière)
  let tendance: AnalyseQualite['tendance'] = null
  if (parCellules.length >= 2) {
    const precedentes = parCellules.slice(1).map((m) => m.cellules)
    const moyPrec = precedentes.reduce((s, v) => s + v, 0) / precedentes.length
    if (moyPrec > 0) {
      const delta = (d.cellules - moyPrec) / moyPrec
      tendance = delta > 0.15 ? 'hausse' : delta < -0.15 ? 'baisse' : 'stable'
    }
  }

  return {
    derniere,
    moyenneCellules,
    moyenneMg,
    moyenneMp,
    nbMesures: parCellules.length,
    tendance,
    statut: statutCellules(d.cellules, cat),
  }
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
