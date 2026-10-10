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
 *   tarissement de l'espèce, ajustée à la demande MOYENNE des 7 derniers
 *   jours (FAO-56 éq. 81) et bornée pour que l'urgence ne recule jamais sans
 *   eau (voir `EtatBilan`) ;
 * - chaque jour, l'épuisement Dr gagne l'ETc (Kc au stade × ET0, réduite par
 *   le coefficient de stress Ks au-delà de RAW, éq. 84) et perd la pluie
 *   utile ; un arrosage noté remet le sol à la capacité au champ (Dr = 0) ;
 *   l'excès draine (Dr ≥ 0) ;
 * - l'urgence vient de Dr rapporté à RAW et TAW, corrigée par la pluie
 *   prévue à 48 h ; la dose d'un arrosage est l'épuisement, au plus RAW.
 *
 * Module PUR (aucune base, aucun réseau) : la météo et les arrosages notés
 * sont chargés par l'appelant. Hypothèses documentées, faute d'humidité
 * mesurée : le sol est à la capacité au champ au premier jour de
 * l'historique, qui est FIXE pour la saison (`debutHistoriqueBilan`,
 * meteo-bilan.ts : 1er janvier, recharge hivernale ; une fenêtre glissante
 * oubliait chaque jour un jour de consommation et l'urgence reculait sans
 * eau) ; une culture est mise en place dans un sol humide (arrosage de
 * plantation) ; un arrosage noté compte comme un plein (volume inconnu :
 * noter, c'est dire « la planche a eu son eau », le bilan repart de zéro).
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
  /** Jours (AAAA-MM-JJ) d'un arrosage de volume inconnu (« Noter ») : le sol est remis plein. */
  joursArroses: string[]
  /**
   * Arrosages de volume connu (intervention « arrosage » avec ses litres) :
   * eau arrivée au sol (mm = L/m² versés × efficacité du système), retranchée
   * de l'épuisement comme une pluie.
   */
  apports?: { date: string; mm: number }[]
  /** Sol de la planche, sinon (`typeSolParcelle`) celui de sa parcelle. Textes libres tolérés. */
  sol: { typeSol: string | null; retentionEau: string | null; typeSolParcelle?: string | null }
  culture: {
    espece: string
    besoinEau: number // 1-5
    /** Mise en place sur la planche (plantation faite, sinon semis), AAAA-MM-JJ ; null = inconnu. */
    debut: string | null
    /** Durée du cycle en jours (voir `dureeCycleJours`) ; null = 120. */
    dureeCycleJours: number | null
    sousAbri: boolean
    /** Espèce vivace : une fois installée (un an), son Kc suit la saison, ses racines sont en place. */
    vivace?: boolean
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
  /** Dose d'un arrosage (mm = L/m² au sol) : l'épuisement, au plus la réserve facile ; 0 si rien à faire. */
  doseMm: number
  /** Évapotranspiration de la culture aujourd'hui (potentielle) et moyennes des 7 derniers jours. */
  etcJour: number
  /** Consommation réelle (réduite par le stress). */
  etcMoyenne7j: number
  /** Besoin potentiel (sans stress) : base du volume hebdomadaire affiché. */
  etcPotentielleMoyenne7j: number
  kc: number
  profondeurRacinesM: number
  /** Pluie (mm) attendue sur les deux prochains jours, 0 sous abri. */
  pluiePrevue48h: number
  /** Dernier apport ayant rechargé le sol (pluie utile ≥ 10 mm ou arrosage noté). */
  dernierApport: { type: 'pluie' | 'arrosage'; date: string; mm: number | null } | null
  /** Sol connu (planche ou parcelle) ; sinon la réserve est celle d'un sol moyen. */
  solRenseigne: boolean
}

// ── Référentiels ─────────────────────────────────────────────

/**
 * Eau disponible du sol (mm d'eau par m de sol, capacité au champ − point de
 * flétrissement). FAO-56 tableau 19 : sable 50-110, limon 130-210, argile
 * 120-200. Valeurs basses de fourchette, prudentes pour un sol de maraîchage.
 */
const EAU_DISPONIBLE_DEFAUT = 130

/**
 * Texture → eau disponible, sur le texte normalisé : la planche écrit
 * « Sableux », la parcelle « sableux » ou « calcaire », d'anciennes saisies
 * « limono-argileux » (ticket QA cmv2re9vl : le sol de la parcelle n'était
 * pas lu, ni ses écritures reconnues). Sol mixte de texture : moyenne.
 */
function eauDisponibleTexture(texte: string | null | undefined): number | null {
  const t = normaliserNom(texte ?? '')
  if (!t) return null
  const sable = t.includes('sabl'), limon = t.includes('limon'), argile = t.includes('argil')
  if (sable) return limon || argile ? 110 : 80
  if (t.includes('caillou')) return 90
  if (t.includes('franche')) return 150
  if (limon && argile) return 160
  if (argile) return 150
  if (limon) return 170
  if (t.includes('humif') || t.includes('tourb')) return 200
  if (t.includes('calcaire')) return 120
  if (t.includes('mixte')) return 130
  return null
}

function eauDisponibleRetention(texte: string | null | undefined): number | null {
  const t = normaliserNom(texte ?? '')
  if (t.includes('faible')) return 80
  if (t.includes('moyen')) return 130
  if (t.includes('elev') || t.includes('fort')) return 160
  return null
}

/** Texture de la planche, sinon sa rétention, sinon la texture de la parcelle ; null si rien. */
function eauDisponibleConnue(sol: EntreeBilanSol['sol']): number | null {
  return eauDisponibleTexture(sol.typeSol) ?? eauDisponibleRetention(sol.retentionEau) ?? eauDisponibleTexture(sol.typeSolParcelle)
}

export function eauDisponibleSol(sol: EntreeBilanSol['sol']): number {
  return eauDisponibleConnue(sol) ?? EAU_DISPONIBLE_DEFAUT
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
  Concombre: { kc: { initial: 0.6, mi: 1.0, fin: 0.75 }, racinesM: 0.7, p: 0.5 },
  Melon: { kc: { initial: 0.5, mi: 1.05, fin: 0.75 }, racinesM: 0.8, p: 0.4 },
  Pasteque: { kc: { initial: 0.4, mi: 1.0, fin: 0.75 }, racinesM: 0.8, p: 0.4 },
  Poivron: { kc: { initial: 0.6, mi: 1.05, fin: 0.9 }, racinesM: 0.5, p: 0.3 },
  Aubergine: { kc: { initial: 0.6, mi: 1.05, fin: 0.9 }, racinesM: 0.7, p: 0.45 },
  Salade: { kc: { initial: 0.7, mi: 1.0, fin: 0.95 }, racinesM: 0.3, p: 0.3 },
  Epinard: { kc: { initial: 0.7, mi: 1.0, fin: 0.95 }, racinesM: 0.3, p: 0.2 },
  Blette: { kc: { initial: 0.7, mi: 1.0, fin: 0.95 }, racinesM: 0.4, p: 0.3 },
  Celeri: { kc: { initial: 0.7, mi: 1.05, fin: 1.0 }, racinesM: 0.3, p: 0.2 },
  Fenouil: { kc: { initial: 0.7, mi: 1.0, fin: 0.95 }, racinesM: 0.4, p: 0.3 },
  Radis: { kc: { initial: 0.7, mi: 0.9, fin: 0.85 }, racinesM: 0.3, p: 0.3 },
  Navet: { kc: { initial: 0.5, mi: 1.1, fin: 0.95 }, racinesM: 0.5, p: 0.5 },
  Chou: { kc: { initial: 0.7, mi: 1.05, fin: 0.95 }, racinesM: 0.5, p: 0.45 },
  Brocoli: { kc: { initial: 0.7, mi: 1.05, fin: 0.95 }, racinesM: 0.4, p: 0.45 },
  Carotte: { kc: { initial: 0.7, mi: 1.05, fin: 0.95 }, racinesM: 0.5, p: 0.35 },
  Betterave: { kc: { initial: 0.5, mi: 1.05, fin: 0.95 }, racinesM: 0.6, p: 0.5 },
  Oignon: { kc: { initial: 0.7, mi: 1.05, fin: 0.75 }, racinesM: 0.3, p: 0.3 },
  Ail: { kc: { initial: 0.7, mi: 1.0, fin: 0.7 }, racinesM: 0.3, p: 0.3 },
  Poireau: { kc: { initial: 0.7, mi: 1.0, fin: 1.0 }, racinesM: 0.3, p: 0.3 },
  'Pomme de terre': { kc: { initial: 0.5, mi: 1.15, fin: 0.75 }, racinesM: 0.4, p: 0.35 },
  'Patate douce': { kc: { initial: 0.5, mi: 1.15, fin: 0.65 }, racinesM: 1.0, p: 0.65 },
  Haricot: { kc: { initial: 0.4, mi: 1.15, fin: 0.35 }, racinesM: 0.5, p: 0.45 },
  Pois: { kc: { initial: 0.5, mi: 1.15, fin: 0.3 }, racinesM: 0.6, p: 0.35 },
  Feve: { kc: { initial: 0.5, mi: 1.15, fin: 0.3 }, racinesM: 0.5, p: 0.45 },
  Mais: { kc: { initial: 0.3, mi: 1.15, fin: 1.05 }, racinesM: 0.8, p: 0.5 },
  Artichaut: { kc: { initial: 0.5, mi: 1.0, fin: 0.95 }, racinesM: 0.6, p: 0.45 },
  Asperge: { kc: { initial: 0.5, mi: 0.95, fin: 0.3 }, racinesM: 1.2, p: 0.45 },
  Fraise: { kc: { initial: 0.4, mi: 0.85, fin: 0.75 }, racinesM: 0.2, p: 0.2 },
  Aromatique: { kc: { initial: 0.7, mi: 1.0, fin: 0.9 }, racinesM: 0.3, p: 0.4 },
  Topinambour: { kc: { initial: 0.5, mi: 1.1, fin: 0.75 }, racinesM: 0.6, p: 0.4 },
  Rhubarbe: { kc: { initial: 0.5, mi: 0.95, fin: 0.85 }, racinesM: 0.5, p: 0.4 },
  // Petits fruits (FAO-56 « berries, bush ») : vivaces, voir `stadeAuJour`.
  'Petit fruit': { kc: { initial: 0.3, mi: 1.05, fin: 0.5 }, racinesM: 0.6, p: 0.5 },
}

/** Noms usuels rattachés à un profil (clés normalisées, voir `normaliserNom`). */
const ALIAS: Record<string, string> = {
  laitue: 'Salade', mache: 'Salade', roquette: 'Salade', chicoree: 'Salade', endive: 'Salade', mesclun: 'Salade',
  bette: 'Blette', 'blette a carde': 'Blette',
  potiron: 'Courge', potimarron: 'Courge', butternut: 'Courge', citrouille: 'Courge',
  piment: 'Poivron',
  cornichon: 'Concombre',
  'chou fleur': 'Chou', 'chou rave': 'Chou', 'chou kale': 'Chou', kale: 'Chou',
  echalote: 'Oignon', ciboule: 'Oignon', ciboulette: 'Oignon',
  'petit pois': 'Pois', 'pois gourmand': 'Pois', 'mange tout': 'Pois',
  'haricot vert': 'Haricot', 'haricot sec': 'Haricot',
  'mais doux': 'Mais',
  fraisier: 'Fraise',
  groseillier: 'Petit fruit', framboisier: 'Petit fruit', cassissier: 'Petit fruit', myrtillier: 'Petit fruit',
  mure: 'Petit fruit', murier: 'Petit fruit', 'mure sans epine': 'Petit fruit', mures: 'Petit fruit',
  basilic: 'Aromatique', persil: 'Aromatique', coriandre: 'Aromatique', aneth: 'Aromatique',
  celeri: 'Celeri', 'celeri rave': 'Celeri', 'celeri branche': 'Celeri',
  'pomme de terre': 'Pomme de terre', patate: 'Pomme de terre',
}

/** Minuscules, sans accents, tirets et espaces multiples ramenés à un espace. */
export function normaliserNom(nom: string): string {
  return (nom ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** « tomates » → « tomate », « choux » → « chou » ; « radis », « pois » restent. */
function singulier(mot: string): string {
  if (mot.length > 4 && /x$/.test(mot)) return mot.slice(0, -1)
  if (mot.length > 4 && /[^s]s$/.test(mot) && !/(is|ois|us)$/.test(mot)) return mot.slice(0, -1)
  return mot
}

const PROFILS_NORMALISES = new Map<string, ProfilEspece>(
  Object.entries(PROFILS).map(([nom, profil]) => [normaliserNom(nom), profil]),
)

/**
 * Profil d'une espèce : par nom (normalisé : casse, accents, pluriel, alias,
 * puis préfixes de plus en plus courts : « Tomate cerise » → Tomate,
 * « Petit pois » → Pois), sinon dérivé du besoin en eau (1-5) déclaré au
 * référentiel : une espèce gourmande consomme plus (Kc) et tolère moins de
 * tarissement (p).
 */
export function profilEspece(espece: string, besoinEau: number): ProfilEspece {
  const mots = normaliserNom(espece).split(' ').filter(Boolean).map(singulier)
  // Préfixes du plus long au plus court : « Pomme de terre primeur » → « pomme de terre ».
  for (let n = mots.length; n > 0; n--) {
    const c = mots.slice(0, n).join(' ')
    const alias = ALIAS[c]
    if (alias) return PROFILS[alias]
    const profil = PROFILS_NORMALISES.get(c)
    if (profil) return profil
  }
  const b = Math.min(5, Math.max(1, besoinEau || 3))
  return {
    kc: { initial: 0.6, mi: 0.8 + 0.08 * b, fin: 0.8 },
    racinesM: 0.4,
    p: Math.round((0.55 - 0.05 * b) * 100) / 100,
  }
}

/**
 * Kc au stade (0 = mise en place, 1 = fin de cycle), courbe FAO-56 en quatre
 * phases : initiale (15 %), développement (30 %), PLATEAU de mi-saison
 * (35 %), arrière-saison (20 %). Sans plateau, une tomate en pleine saison
 * était comptée à Kc 0,88 au lieu de 1,15.
 */
export function kcAuStade(profil: ProfilEspece, stade: number): number {
  const { initial, mi, fin } = profil.kc
  if (stade < 0.15) return initial
  if (stade < 0.45) return initial + ((stade - 0.15) / 0.3) * (mi - initial)
  if (stade < 0.8) return mi
  return mi + (Math.min(1, stade - 0.8) / 0.2) * (fin - mi)
}

/** Profondeur racinaire (m) : 0,15 m à la mise en place, pleine en fin de développement. */
export function racinesAuStade(profil: ProfilEspece, stade: number): number {
  const min = 0.15
  if (profil.racinesM <= min) return profil.racinesM
  return min + (profil.racinesM - min) * Math.min(1, stade / 0.45)
}

/**
 * Durée du cycle (jours) depuis la mise en place jusqu'à la fin de récolte.
 * Sans fin de récolte, `dateRecolte` n'est que le DÉBUT de la récolte : on
 * prolonge de 30 jours, sinon toute la récolte était calculée en arrière-saison.
 */
export function dureeCycleJours(debut: string | null, dateRecolte: string | null, finRecolte: string | null): number | null {
  if (!debut) return null
  if (finRecolte) return joursEntre(debut, finRecolte)
  if (dateRecolte) return joursEntre(debut, dateRecolte) + 30
  return null
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
const JOURS_MOYENNE_DEMANDE = 7
/** Au-delà (L/m² versés), un passage ruisselle plus qu'il ne pénètre (arrosoir, tuyau, aspersion). */
export const LITRES_M2_MAX_PAR_PASSAGE = 20

export function pluieUtile(pluie: number): number {
  return Math.max(0, (pluie - PLUIE_INTERCEPTEE_MM) * EFFICACITE_PLUIE)
}

/** Part de l'eau versée qui arrive aux racines selon le système d'arrosage. */
export function efficaciteArrosage(systeme: string | null | undefined): number {
  const s = normaliserNom(systeme ?? '')
  return s.includes('goutte') ? 0.9 : s.includes('aspersion') ? 0.75 : 0.8
}

/**
 * Volume à verser : la dose au sol divisée par l'efficacité du système
 * (goutte-à-goutte 0,9, aspersion 0,75, arrosoir ou tuyau 0,8), pour la
 * surface arrosée, en passages d'au plus 20 L/m² (le goutte-à-goutte, qui
 * n'apporte qu'au pied, en un seul). Seul calcul de volume des écrans.
 */
export function volumeArrosage(doseMm: number, surfaceM2: number, systeme: string | null | undefined) {
  const goutte = normaliserNom(systeme ?? '').includes('goutte')
  const efficacite = efficaciteArrosage(systeme)
  const litresParM2 = doseMm > 0 ? Math.round((doseMm / efficacite) * 10) / 10 : 0
  // 10 % de tolérance : 20,6 L/m² se versent en une fois, pas en deux de 10.
  const passages = litresParM2 === 0 ? 0 : goutte ? 1 : Math.ceil(litresParM2 / (LITRES_M2_MAX_PAR_PASSAGE * 1.1))
  return { litresParM2, litres: Math.round(litresParM2 * Math.max(0, surfaceM2)), passages }
}

/** Fin de phrase d'un conseil de volume (« Apport conseillé : … ») ; vide si rien à verser. */
export function phraseVolume(v: ReturnType<typeof volumeArrosage>, cible: string): string {
  if (v.litresParM2 === 0) return ''
  const litres = v.litres > 0 ? `, soit ${v.litres} L ${cible}` : ''
  const passages = v.passages >= 2
    ? `, en ${v.passages} passages d'environ ${Math.round(v.litresParM2 / v.passages)} L/m² espacés de quelques heures`
    : ''
  return `Apport conseillé : ${v.litresParM2} L/m²${litres}${passages}.`
}

function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000)
}

function formatJour(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// ── Bilan ───────────────────────────────────────────────────

/** Une vivace en terre depuis plus d'un an (ou sans date) est installée. */
function vivaceInstallee(e: EntreeBilanSol, date: string): boolean {
  return !!e.culture.vivace && (!e.culture.debut || joursEntre(e.culture.debut, date) > 365)
}

/**
 * Stade d'une vivace installée : la saison de végétation va du 1er mars
 * (débourrement) au 31 octobre (chute des feuilles) ; en dormance, de
 * novembre à février, le Kc est celui du départ de végétation (stade 0).
 * Repère de l'hémisphère nord (métropole).
 */
function stadeSaisonnier(date: string): number {
  const [a, m, j] = date.split('-').map(Number)
  const quantieme = (Date.UTC(a, m - 1, j) - Date.UTC(a, 0, 1)) / 86_400_000
  const stade = (quantieme - 59) / 245
  return stade < 0 || stade > 1 ? 0 : stade
}

function stadeAuJour(e: EntreeBilanSol, date: string): number {
  if (vivaceInstallee(e, date)) return stadeSaisonnier(date)
  if (!e.culture.debut) return 0.5
  const duree = Math.max(30, e.culture.dureeCycleJours ?? CYCLE_DEFAUT_JOURS)
  return Math.min(1, Math.max(0, joursEntre(e.culture.debut, date) / duree))
}

function enPlace(e: EntreeBilanSol, date: string): boolean {
  return !e.culture.debut || date >= e.culture.debut
}

/** FAO-56 éq. 81 : p ajusté à la demande `etc` (mm/j), borné 0,1-0,8. */
function pAjuste(profil: ProfilEspece, etc: number): number {
  return Math.min(0.8, Math.max(0.1, profil.p + 0.04 * (5 - etc)))
}

function moyenne(valeurs: number[]): number {
  return valeurs.length ? valeurs.reduce((s, v) => s + v, 0) / valeurs.length : 0
}

/**
 * État du bilan d'un jour à l'autre. La fraction p de la réserve facile suit
 * la demande moyenne des 7 derniers jours (éq. 81). Avec un p libre, une
 * ligne « à arroser » apparaissait un jour de chaleur et disparaissait le
 * lendemain plus frais, sans une goutte d'eau. Donc :
 * - p BAISSE sans délai (vague de chaleur : arroser plus tôt) ;
 * - p REMONTE (fraîcheur) sans que la réserve facile gagne plus, en
 *   proportion, que l'épuisement du jour : sans pluie ni arrosage, la part
 *   consommée ne recule jamais, et l'urgence non plus ; un jour de pluie,
 *   elle ne recule que de l'eau reçue. Seule une recharge complète (sol à la
 *   capacité au champ) rend à p sa valeur du jour.
 * Bloquer p jusqu'à la prochaine recharge gardait en octobre le seuil de la
 * chaleur de septembre (réserve facile sous-estimée de 4 mm sur 49).
 */
interface EtatBilan {
  depletion: number
  p: number | null
  potentielles: number[]
}

interface Pas {
  etc: number
  potentielle: number
  kc: number
  zr: number
  taw: number
  raw: number
}

export function bilanReserveSol(e: EntreeBilanSol): ResultatBilanSol {
  const profil = profilEspece(e.culture.espece, e.culture.besoinEau)
  const eauDispo = eauDisponibleSol(e.sol)
  const arroses = new Set(e.joursArroses)
  const apportsDuJour = new Map<string, number>()
  for (const a of e.apports ?? []) apportsDuJour.set(a.date, (apportsDuJour.get(a.date) ?? 0) + Math.max(0, a.mm))
  const facteurEt = e.culture.sousAbri ? FACTEUR_ET_SOUS_ABRI : 1
  const pluieDe = (j: JourMeteoBilan) => (e.culture.sousAbri ? 0 : pluieUtile(j.pluie))

  /** Avance l'état d'un jour (culture en place) et décrit ce jour. */
  const avancer = (etat: EtatBilan, jour: JourMeteoBilan, arrose: boolean, apport = 0): Pas => {
    const stade = stadeAuJour(e, jour.date)
    const kc = kcAuStade(profil, stade)
    const zr = vivaceInstallee(e, jour.date) ? profil.racinesM : racinesAuStade(profil, stade)
    const taw = eauDispo * zr
    const potentielle = kc * jour.et0 * facteurEt
    etat.potentielles.push(potentielle)
    const d = Math.min(etat.depletion, taw)

    const bilanAvec = (p: number) => {
      const raw = p * taw
      // FAO-56 éq. 84 : coefficient de stress quand la réserve facile est épuisée.
      const ks = d <= raw ? 1 : Math.max(0, (taw - d) / Math.max(1e-6, taw - raw))
      const etc = ks * potentielle
      const suivant = arrose ? 0 : Math.min(taw, Math.max(0, d + etc - pluieDe(jour) - apport))
      return { raw, etc, suivant }
    }

    const pJour = pAjuste(profil, moyenne(etat.potentielles.slice(-JOURS_MOYENNE_DEMANDE)))
    let p = etat.p === null || pJour <= etat.p ? pJour : etat.p
    let r = bilanAvec(p)
    if (etat.p !== null && pJour > etat.p) {
      if (r.suivant === 0) {
        // Sol rechargé : rien de consommé, p reprend sa valeur du jour.
        p = pJour
      } else {
        // Gain de réserve facile borné par la HAUSSE nette de l'épuisement :
        // (d + hausse) / (raw + gain) ≥ d / raw  ⇔  gain ≤ hausse × raw / d.
        // Un jour de bruine qui fait baisser l'épuisement, ou sans ET0 (trou
        // de données), ne relève donc pas p : l'urgence ne baisse que de
        // l'eau réellement reçue.
        const rawAvant = etat.p * taw
        const gain = Math.max(0, r.suivant - d) * Math.min(1, rawAvant / Math.max(d, 1e-6))
        p = Math.min(pJour, etat.p + gain / taw)
      }
      r = bilanAvec(p)
    }
    etat.p = p
    etat.depletion = r.suivant
    return { etc: r.etc, potentielle, kc, zr, taw, raw: r.raw }
  }

  // Hypothèse : capacité au champ au début de la fenêtre (voir en-tête).
  const etat: EtatBilan = { depletion: 0, p: null, potentielles: [] }
  let dernierApport: ResultatBilanSol['dernierApport'] = null
  const etcReels: number[] = []
  let duJour: Pas | null = null

  for (const jour of [...e.historique, e.aujourdhui]) {
    // Une culture pas encore en terre ne consomme rien sur sa planche.
    if (!enPlace(e, jour.date)) continue
    const arrose = arroses.has(jour.date)
    const apport = apportsDuJour.get(jour.date) ?? 0
    const r = avancer(etat, jour, arrose, apport)
    etcReels.push(r.etc)
    if (jour === e.aujourdhui) duJour = r
    if (arrose) dernierApport = { type: 'arrosage', date: jour.date, mm: null }
    else if (apport > 0) dernierApport = { type: 'arrosage', date: jour.date, mm: Math.round(apport * 10) / 10 }
    else if (pluieDe(jour) >= PLUIE_RECHARGE_MM) dernierApport = { type: 'pluie', date: jour.date, mm: Math.round(jour.pluie) }
  }
  const depletion = etat.depletion

  // Culture pas encore en place : paramètres de la mise en place, sans consommation.
  if (!duJour) {
    const kc = kcAuStade(profil, 0)
    const zr = racinesAuStade(profil, 0)
    const taw = eauDispo * zr
    duJour = { etc: 0, potentielle: 0, kc, zr, taw, raw: pAjuste(profil, kc * e.aujourdhui.et0 * facteurEt) * taw }
  }
  const { taw, raw } = duJour
  const etcJour = duJour.potentielle
  // Pas encore en place : aucun besoin (ni ETc, ni volume hebdomadaire).
  const etcPotentielleMoyenne7j = moyenne(etat.potentielles.slice(-JOURS_MOYENNE_DEMANDE))
  const etcMoyenne7j = moyenne(etcReels.slice(-JOURS_MOYENNE_DEMANDE))

  // Projection : pluie et ET0 prévues, sans arrosage, à partir de la mise en place.
  const proj: EtatBilan = { depletion, p: etat.p, potentielles: [...etat.potentielles] }
  let joursAvantSeuil: number | null = enPlace(e, e.aujourdhui.date) && depletion >= raw ? 0 : null
  let depletion48h = depletion
  e.previsions.slice(0, HORIZON_PROJECTION_JOURS).forEach((jour, i) => {
    if (enPlace(e, jour.date)) {
      avancer(proj, jour, false)
      if (joursAvantSeuil === null && proj.depletion >= raw) joursAvantSeuil = i + 1
    }
    if (i <= 1) depletion48h = proj.depletion
  })
  const pluiePrevue48h = e.culture.sousAbri ? 0 : e.previsions.slice(0, 2).reduce((s, j) => s + j.pluie, 0)

  const taux = raw > 0 ? depletion / raw : 0
  const seuilCritique = raw + 0.5 * (taw - raw)
  // La pluie prévue dispense si, dans 48 h, la réserve facile n'est plus
  // dépassée (avant : il fallait la remplir à moitié, d'où « arroser » la
  // veille de 30 mm annoncés).
  // La pluie prévue dispense d'un arrosage DÛ (réserve facile dépassée, pas
  // encore critique) si, dans 48 h, la réserve facile n'est plus dépassée ;
  // avant, il fallait la remplir à moitié, d'où « arroser » la veille de 30 mm
  // annoncés. En deçà du seuil elle ne change rien : « à surveiller » le reste.
  const pluieSauve = pluiePrevue48h >= 5 && depletion >= raw && depletion < seuilCritique && depletion48h < raw

  let urgence: UrgenceArrosage
  if (pluieSauve) urgence = 'moyenne'
  else if (depletion >= seuilCritique) urgence = 'critique'
  else if (depletion >= raw) urgence = 'haute'
  else if (depletion >= 0.75 * raw) urgence = 'moyenne'
  else if (depletion >= 0.4 * raw) urgence = 'faible'
  else urgence = 'aucune'

  // Dose d'un arrosage : l'épuisement, au plus la réserve facile (la « dose
  // pratique » de la RFU : sur données réelles, sans arrosage noté depuis
  // l'été, remplir toute la réserve conseillait jusqu'à 127 mm). Les passages
  // (20 L/m² au plus chacun) se calculent sur le volume versé (`volumeArrosage`).
  const aFaire = !pluieSauve && (urgence === 'critique' || urgence === 'haute' || urgence === 'moyenne')
  const doseMm = aFaire ? Math.round(Math.min(depletion, raw) * 10) / 10 : 0

  const premierJour = e.historique[0]?.date ?? e.aujourdhui.date
  const depuis = e.culture.debut && e.culture.debut > premierJour
    ? `la mise en place le ${formatJour(e.culture.debut)}`
    : `le ${formatJour(premierJour)}`
  const apport = dernierApport
    ? dernierApport.type === 'arrosage'
      ? dernierApport.mm === null
        ? `dernier arrosage noté le ${formatJour(dernierApport.date)}`
        : `dernier arrosage le ${formatJour(dernierApport.date)} (${dernierApport.mm} mm au sol)`
      : `dernière pluie utile ${dernierApport.mm} mm le ${formatJour(dernierApport.date)}`
    : `aucun apport notable depuis ${depuis}`
  const reserve = taux < 1
    ? `réserve facile consommée à ${Math.round(taux * 100)} % (${Math.round(depletion)} mm sur ${Math.round(raw)} mm)`
    : `réserve facile épuisée (${Math.round(depletion)} mm consommés pour ${Math.round(raw)} mm, réserve totale ${Math.round(taw)} mm)`
  const dans = joursAvantSeuil !== null && joursAvantSeuil > 0 ? `Arrosage dans ~${joursAvantSeuil} j` : null
  let raison: string
  if (pluieSauve) raison = `${Math.round(pluiePrevue48h)} mm de pluie prévus d'ici 48 h : ${reserve}, ${apport}.`
  else if (urgence === 'critique' || urgence === 'haute') raison = `À arroser : ${reserve}, ${apport}.`
  else if (urgence === 'moyenne') raison = `${dans ?? 'À surveiller'} : ${reserve}, ${apport}.`
  else if (urgence === 'faible') raison = `${dans ?? 'Sol encore pourvu'} : ${reserve}, ${apport}.`
  else raison = `Sol bien pourvu : ${reserve}, ${apport}.`
  if (e.culture.sousAbri) raison = `Sous abri, sans pluie. ${raison}`
  if (aFaire && e.joursArroses.length === 0 && !(e.apports ?? []).length) raison += ' Aucun arrosage noté : le bilan ne compte que la pluie.'
  const solRenseigne = eauDisponibleConnue(e.sol) !== null
  if (!solRenseigne) raison += ' Sol non renseigné (planche et parcelle) : réserve calculée pour un sol moyen.'
  if (!enPlace(e, e.aujourdhui.date)) raison = `Pas encore sur la planche : mise en place prévue le ${formatJour(e.culture.debut!)}.`

  return {
    urgence,
    raison,
    depletionMm: Math.round(depletion * 10) / 10,
    reserveUtileMm: Math.round(taw * 10) / 10,
    reserveFacileMm: Math.round(raw * 10) / 10,
    tauxEpuisement: Math.round(taux * 100) / 100,
    joursAvantSeuil,
    doseMm,
    etcJour: Math.round(etcJour * 100) / 100,
    etcMoyenne7j: Math.round(etcMoyenne7j * 100) / 100,
    etcPotentielleMoyenne7j: Math.round(etcPotentielleMoyenne7j * 100) / 100,
    kc: Math.round(duJour.kc * 100) / 100,
    profondeurRacinesM: Math.round(duJour.zr * 100) / 100,
    pluiePrevue48h: Math.round(pluiePrevue48h * 10) / 10,
    dernierApport,
    solRenseigne,
  }
}
