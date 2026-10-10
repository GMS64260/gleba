/**
 * Moteur unique de décision d'arrosage : bilan hydrique journalier de la
 * réserve du sol (méthode FAO-56 simplifiée, Allen et al. 1998, chap. 8).
 *
 * Itération du 2026-10-10 sur la refonte de l'arrosage. Les deux calculs
 * précédents (conseil des tâches, conseiller du Calendrier) estimaient un
 * déficit sur 7 jours glissants, sans réserve du sol, chacun avec sa propre
 * évapotranspiration. Ici :
 *
 * - la RÉSERVE UTILE (TAW, mm) = eau disponible du sol (mm/m, selon la
 *   texture) × profondeur racinaire (m, selon l'espèce et le stade) ;
 * - la RÉSERVE FACILEMENT UTILISABLE (RAW) = p × TAW, p fraction de
 *   tarissement de l'espèce, ajustée à la demande du jour (FAO-56 éq. 81) ;
 * - chaque jour, l'épuisement Dr gagne l'ETc (Kc au stade × ET0, réduite par
 *   le coefficient de stress Ks quand Dr dépasse RAW) et perd la pluie utile ;
 *   un arrosage noté remet le sol à la capacité au champ (Dr = 0) ; l'excès
 *   draine (Dr ≥ 0) ;
 * - l'urgence vient de Dr rapporté à RAW et TAW, corrigée par la pluie
 *   prévue à 48 h ; la dose conseillée remplit la réserve.
 *
 * Module PUR (aucune base, aucun réseau) : la météo et les arrosages notés
 * sont chargés par l'appelant. Hypothèse documentée : faute d'humidité
 * mesurée, le sol est supposé à la capacité au champ au début de la fenêtre
 * (30 jours) ; la première pluie efficace ou le premier arrosage noté
 * recalent le bilan.
 */

export type UrgenceArrosage = 'critique' | 'haute' | 'moyenne' | 'faible' | 'aucune'

/** Un jour de météo : pluie (mm) et évapotranspiration de référence ET0 (mm). */
export interface JourMeteoBilan {
  date: string // AAAA-MM-JJ, jour civil local
  pluie: number
  et0: number
}

export interface EntreeBilanSol {
  /** Jours passés, du plus ancien à HIER inclus. */
  historique: JourMeteoBilan[]
  /** Aujourd'hui (pluie et ET0 de la prévision du jour). */
  aujourdhui: JourMeteoBilan
  /** Jours suivants (demain d'abord). */
  previsions: JourMeteoBilan[]
  /** Jours (AAAA-MM-JJ) où un arrosage a été noté. */
  joursArroses: string[]
  sol: { typeSol: string | null; retentionEau: string | null }
  culture: {
    espece: string
    besoinEau: number // 1-5
    /** Début de culture (plantation, sinon semis), AAAA-MM-JJ ; null = inconnu. */
    debut: string | null
    /** Durée du cycle en jours (début → fin de récolte) ; null = 120. */
    dureeCycleJours: number | null
    sousAbri: boolean
  }
}

export interface ResultatBilanSol {
  urgence: UrgenceArrosage
  /** Phrase lisible par l'exploitant. */
  raison: string
  /** Épuisement de la réserve aujourd'hui (mm sous la capacité au champ). */
  depletionMm: number
  /** Réserve utile totale et facilement utilisable (mm). */
  reserveUtileMm: number
  reserveFacileMm: number
  /** Part de la réserve facilement utilisable consommée (0 = pleine, 1 = au seuil). */
  tauxEpuisement: number
  /** Jours avant d'atteindre le seuil d'arrosage (0 = atteint ; null = pas dans les 10 jours). */
  joursAvantSeuil: number | null
  /** Dose (mm = L/m²) qui remplit la réserve, à l'efficacité près. */
  doseMm: number
  /** Évapotranspiration de la culture : aujourd'hui et moyenne des 7 derniers jours (mm/j). */
  etcJour: number
  etcMoyenne7j: number
  kc: number
  profondeurRacinesM: number
  /** Pluie (mm) attendue sur les deux prochains jours, 0 sous abri. */
  pluiePrevue48h: number
  /** Dernier apport ayant rechargé le sol (pluie utile ≥ 10 mm ou arrosage noté). */
  dernierApport: { type: 'pluie' | 'arrosage'; date: string; mm: number | null } | null
}

// ── Référentiels ─────────────────────────────────────────────

/**
 * Eau disponible du sol (mm d'eau par m de sol, capacité au champ − point de
 * flétrissement). FAO-56 tableau 19 : sable 50-110, limon 130-210, argile
 * 120-200. Valeurs basses de fourchette, prudentes pour un sol de maraîchage.
 */
const EAU_DISPONIBLE_PAR_TEXTURE: Record<string, number> = {
  Sableux: 80,
  Mixte: 130,
  Limoneux: 170,
  Argileux: 150,
}
const EAU_DISPONIBLE_PAR_RETENTION: Record<string, number> = {
  Faible: 80,
  Moyenne: 130,
  Élevée: 160,
}
const EAU_DISPONIBLE_DEFAUT = 130

export function eauDisponibleSol(sol: EntreeBilanSol['sol']): number {
  if (sol.typeSol && EAU_DISPONIBLE_PAR_TEXTURE[sol.typeSol]) return EAU_DISPONIBLE_PAR_TEXTURE[sol.typeSol]
  if (sol.retentionEau && EAU_DISPONIBLE_PAR_RETENTION[sol.retentionEau]) return EAU_DISPONIBLE_PAR_RETENTION[sol.retentionEau]
  return EAU_DISPONIBLE_DEFAUT
}

interface ProfilEspece {
  kc: { initial: number; mi: number; fin: number }
  /** Profondeur racinaire maximale exploitée (m) et fraction de tarissement p. */
  racinesM: number
  p: number
}

/**
 * FAO-56 tableaux 12 (Kc) et 22 (profondeur racinaire, p). Profondeurs en bas
 * de fourchette : en maraîchage arrosé, l'enracinement reste superficiel.
 */
const PROFILS: Record<string, ProfilEspece> = {
  Tomate: { kc: { initial: 0.6, mi: 1.15, fin: 0.8 }, racinesM: 0.7, p: 0.4 },
  Courgette: { kc: { initial: 0.5, mi: 1.0, fin: 0.8 }, racinesM: 0.6, p: 0.5 },
  Courge: { kc: { initial: 0.5, mi: 1.0, fin: 0.8 }, racinesM: 0.8, p: 0.5 },
  Potiron: { kc: { initial: 0.5, mi: 1.0, fin: 0.8 }, racinesM: 0.8, p: 0.5 },
  Potimarron: { kc: { initial: 0.5, mi: 1.0, fin: 0.8 }, racinesM: 0.8, p: 0.5 },
  Concombre: { kc: { initial: 0.6, mi: 1.0, fin: 0.75 }, racinesM: 0.7, p: 0.5 },
  Melon: { kc: { initial: 0.5, mi: 1.05, fin: 0.75 }, racinesM: 0.8, p: 0.4 },
  Poivron: { kc: { initial: 0.6, mi: 1.05, fin: 0.9 }, racinesM: 0.5, p: 0.3 },
  Piment: { kc: { initial: 0.6, mi: 1.05, fin: 0.9 }, racinesM: 0.5, p: 0.3 },
  Aubergine: { kc: { initial: 0.6, mi: 1.05, fin: 0.9 }, racinesM: 0.7, p: 0.45 },
  Salade: { kc: { initial: 0.7, mi: 1.0, fin: 0.95 }, racinesM: 0.3, p: 0.3 },
  Laitue: { kc: { initial: 0.7, mi: 1.0, fin: 0.95 }, racinesM: 0.3, p: 0.3 },
  Épinard: { kc: { initial: 0.7, mi: 1.0, fin: 0.95 }, racinesM: 0.3, p: 0.2 },
  Radis: { kc: { initial: 0.7, mi: 0.9, fin: 0.85 }, racinesM: 0.3, p: 0.3 },
  Chou: { kc: { initial: 0.7, mi: 1.05, fin: 0.95 }, racinesM: 0.5, p: 0.45 },
  Brocoli: { kc: { initial: 0.7, mi: 1.05, fin: 0.95 }, racinesM: 0.4, p: 0.45 },
  Carotte: { kc: { initial: 0.7, mi: 1.05, fin: 0.95 }, racinesM: 0.5, p: 0.35 },
  Betterave: { kc: { initial: 0.5, mi: 1.05, fin: 0.95 }, racinesM: 0.6, p: 0.5 },
  Oignon: { kc: { initial: 0.7, mi: 1.05, fin: 0.75 }, racinesM: 0.3, p: 0.3 },
  Ail: { kc: { initial: 0.7, mi: 1.0, fin: 0.7 }, racinesM: 0.3, p: 0.3 },
  Poireau: { kc: { initial: 0.7, mi: 1.0, fin: 1.0 }, racinesM: 0.3, p: 0.3 },
  'Pomme de terre': { kc: { initial: 0.5, mi: 1.15, fin: 0.75 }, racinesM: 0.4, p: 0.35 },
  Haricot: { kc: { initial: 0.4, mi: 1.15, fin: 0.35 }, racinesM: 0.5, p: 0.45 },
  Pois: { kc: { initial: 0.5, mi: 1.15, fin: 0.3 }, racinesM: 0.6, p: 0.35 },
  Fraise: { kc: { initial: 0.4, mi: 0.85, fin: 0.75 }, racinesM: 0.2, p: 0.2 },
  Fraisier: { kc: { initial: 0.4, mi: 0.85, fin: 0.75 }, racinesM: 0.2, p: 0.2 },
}

/**
 * Profil d'une espèce : par nom (premier mot, insensible à la casse : « Tomate
 * cerise » → Tomate), sinon dérivé du besoin en eau (1-5) déclaré au
 * référentiel : une espèce gourmande consomme plus (Kc) et tolère moins de
 * tarissement (p).
 */
export function profilEspece(espece: string, besoinEau: number): ProfilEspece {
  const nom = (espece ?? '').trim()
  const candidats = [nom, nom.split(/[\s(—-]/)[0]].map((n) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase())
  for (const c of candidats) if (PROFILS[c]) return PROFILS[c]
  const b = Math.min(5, Math.max(1, besoinEau || 3))
  return {
    kc: { initial: 0.6, mi: 0.8 + 0.08 * b, fin: 0.8 },
    racinesM: 0.4,
    p: Math.round((0.55 - 0.05 * b) * 100) / 100,
  }
}

/** Kc au stade (0 = début, 1 = fin de cycle), courbe FAO en trois paliers. */
export function kcAuStade(profil: ProfilEspece, stade: number): number {
  const { initial, mi, fin } = profil.kc
  if (stade < 0.25) return initial
  if (stade < 0.75) return initial + ((stade - 0.25) / 0.5) * (mi - initial)
  return mi + (Math.min(1, stade - 0.75) / 0.25) * (fin - mi)
}

/** Profondeur racinaire (m) : 0,15 m au départ, pleine profondeur à mi-cycle. */
export function racinesAuStade(profil: ProfilEspece, stade: number): number {
  const min = 0.15
  if (profil.racinesM <= min) return profil.racinesM
  return min + (profil.racinesM - min) * Math.min(1, stade / 0.5)
}

// ── Constantes du bilan ─────────────────────────────────────

/** Sous abri, ET0 intérieure ≈ 80 % de l'extérieure (rayonnement et vent réduits). */
export const FACTEUR_ET_SOUS_ABRI = 0.8
/** Pluie interceptée ou évaporée avant d'atteindre les racines (mm/j). */
export const PLUIE_INTERCEPTEE_MM = 2
/** Part de la pluie au-delà de l'interception qui s'infiltre. */
export const EFFICACITE_PLUIE = 0.9
/** Une pluie utile qui recharge vraiment (mm) : repère du dernier apport. */
const PLUIE_RECHARGE_MM = 10
const CYCLE_DEFAUT_JOURS = 120
const HORIZON_PROJECTION_JOURS = 10

export function pluieUtile(pluie: number): number {
  return Math.max(0, (pluie - PLUIE_INTERCEPTEE_MM) * EFFICACITE_PLUIE)
}

function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000)
}

function formatJour(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// ── Bilan ───────────────────────────────────────────────────

interface EtatJour {
  depletion: number
  taw: number
  raw: number
  etc: number
  kc: number
  zr: number
}

/** Paramètres de la culture un jour donné (Kc, racines, réserves). */
function parametresJour(jour: JourMeteoBilan, e: EntreeBilanSol, profil: ProfilEspece, eauDispo: number) {
  const stade = stadeAuJour(e, jour.date)
  const kc = kcAuStade(profil, stade)
  const zr = racinesAuStade(profil, stade)
  const taw = eauDispo * zr
  const et0 = jour.et0 * (e.culture.sousAbri ? FACTEUR_ET_SOUS_ABRI : 1)
  // FAO-56 éq. 81 : p s'ajuste à la demande du jour (plus de tarissement
  // toléré quand l'évaporation est faible), borné 0,1-0,8.
  const p = Math.min(0.8, Math.max(0.1, profil.p + 0.04 * (5 - kc * et0)))
  return { kc, zr, taw, raw: p * taw, et0 }
}

/** Un pas de bilan : renvoie l'état en fin de journée. */
function pasJournalier(
  depletion: number,
  jour: JourMeteoBilan,
  e: EntreeBilanSol,
  profil: ProfilEspece,
  eauDispo: number,
  arrose: boolean,
): EtatJour {
  const { kc, zr, taw, raw, et0 } = parametresJour(jour, e, profil, eauDispo)
  // FAO-56 éq. 84 : coefficient de stress quand la réserve facile est épuisée.
  const ks = depletion <= raw ? 1 : Math.max(0, (taw - depletion) / Math.max(1e-6, taw - raw))
  const etc = ks * kc * et0
  const pluie = e.culture.sousAbri ? 0 : pluieUtile(jour.pluie)
  let d = Math.min(taw, Math.max(0, depletion + etc - pluie))
  if (arrose) d = 0
  return { depletion: d, taw, raw, etc, kc, zr }
}

function stadeAuJour(e: EntreeBilanSol, date: string): number {
  if (!e.culture.debut) return 0.5
  const duree = Math.max(30, e.culture.dureeCycleJours ?? CYCLE_DEFAUT_JOURS)
  return Math.min(1, Math.max(0, joursEntre(e.culture.debut, date) / duree))
}

export function bilanReserveSol(e: EntreeBilanSol): ResultatBilanSol {
  const profil = profilEspece(e.culture.espece, e.culture.besoinEau)
  const eauDispo = eauDisponibleSol(e.sol)
  const arroses = new Set(e.joursArroses)

  // Hypothèse : capacité au champ au début de la fenêtre (voir en-tête).
  let depletion = 0
  let dernierApport: ResultatBilanSol['dernierApport'] = null
  const etcRecents: number[] = []
  for (const jour of [...e.historique, e.aujourdhui]) {
    // Une culture pas encore en terre ne consomme rien sur sa planche.
    if (e.culture.debut && jour.date < e.culture.debut) continue
    const etat = pasJournalier(depletion, jour, e, profil, eauDispo, arroses.has(jour.date))
    depletion = etat.depletion
    etcRecents.push(etat.etc)
    if (arroses.has(jour.date)) dernierApport = { type: 'arrosage', date: jour.date, mm: null }
    else if (!e.culture.sousAbri && pluieUtile(jour.pluie) >= PLUIE_RECHARGE_MM) {
      dernierApport = { type: 'pluie', date: jour.date, mm: Math.round(jour.pluie) }
    }
  }

  const aujourdhui = parametresJour(e.aujourdhui, e, profil, eauDispo)
  const taw = aujourdhui.taw
  const raw = aujourdhui.raw
  const etcJour = aujourdhui.et0 * aujourdhui.kc
  const derniers7 = etcRecents.slice(-7)
  const etcMoyenne7j = derniers7.length ? derniers7.reduce((s, v) => s + v, 0) / derniers7.length : etcJour

  // Projection : pluie et ET0 prévues, sans arrosage.
  let proj = depletion
  let joursAvantSeuil: number | null = depletion >= raw ? 0 : null
  let depletion48h = depletion
  e.previsions.slice(0, HORIZON_PROJECTION_JOURS).forEach((jour, i) => {
    proj = pasJournalier(proj, jour, e, profil, eauDispo, false).depletion
    if (i === 1) depletion48h = proj
    if (joursAvantSeuil === null && proj >= raw) joursAvantSeuil = i + 1
  })
  if (e.previsions.length < 2) depletion48h = proj
  const pluiePrevue48h = e.culture.sousAbri ? 0 : e.previsions.slice(0, 2).reduce((s, j) => s + j.pluie, 0)

  const taux = raw > 0 ? depletion / raw : 0
  const seuilCritique = raw + 0.5 * (taw - raw)
  // La pluie prévue ne dispense que si elle remonte vraiment la réserve.
  const pluieSauve = pluiePrevue48h >= 5 && depletion48h < 0.5 * raw

  let urgence: UrgenceArrosage
  if (pluieSauve && depletion < seuilCritique) urgence = depletion >= 0.75 * raw ? 'faible' : 'aucune'
  else if (depletion >= seuilCritique) urgence = 'critique'
  else if (depletion >= raw) urgence = 'haute'
  else if (depletion >= 0.75 * raw) urgence = 'moyenne'
  else if (depletion >= 0.4 * raw) urgence = 'faible'
  else urgence = 'aucune'

  const pct = Math.round(Math.min(1.99, taux) * 100)
  const apport = dernierApport
    ? dernierApport.type === 'arrosage'
      ? `dernier arrosage noté le ${formatJour(dernierApport.date)}`
      : `dernière pluie utile ${dernierApport.mm} mm le ${formatJour(dernierApport.date)}`
    : 'aucun apport notable depuis 30 jours'
  const reserve = `réserve facile consommée à ${pct} % (${Math.round(depletion)} mm sur ${Math.round(raw)} mm)`
  let raison: string
  if (pluieSauve && urgence !== 'critique') {
    raison = `${Math.round(pluiePrevue48h)} mm de pluie prévus d'ici 48 h : ${reserve}, ${apport}.`
  } else if (urgence === 'critique' || urgence === 'haute') {
    raison = `À arroser : ${reserve}, ${apport}.`
  } else if (joursAvantSeuil !== null && joursAvantSeuil > 0) {
    raison = `Arrosage dans ~${joursAvantSeuil} j : ${reserve}, ${apport}.`
  } else {
    raison = `Sol bien pourvu : ${reserve}, ${apport}.`
  }
  if (e.culture.sousAbri) raison = `Sous abri, sans pluie. ${raison}`

  return {
    urgence,
    raison,
    depletionMm: Math.round(depletion * 10) / 10,
    reserveUtileMm: Math.round(taw * 10) / 10,
    reserveFacileMm: Math.round(raw * 10) / 10,
    tauxEpuisement: Math.round(taux * 100) / 100,
    joursAvantSeuil,
    doseMm: urgence === 'aucune' || urgence === 'faible' ? 0 : Math.round(depletion * 10) / 10,
    etcJour: Math.round(etcJour * 100) / 100,
    etcMoyenne7j: Math.round(etcMoyenne7j * 100) / 100,
    kc: Math.round(aujourdhui.kc * 100) / 100,
    profondeurRacinesM: Math.round(aujourdhui.zr * 100) / 100,
    pluiePrevue48h: Math.round(pluiePrevue48h * 10) / 10,
    dernierApport,
  }
}
