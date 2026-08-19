/**
 * Service calendrier lunaire pour le jardinage
 * Calcul astronomique local : instants VRAIS des phases (Meeus, « Astronomical
 * Algorithms », ch. 49, termes principaux — précision de l'ordre de quelques
 * minutes, ΔT négligé).
 *
 * TICKET cmsoglmwb (2026-08-11) — l'ancien modèle d'âge lunaire MOYEN (cycle
 * synodique constant depuis le 06/01/2000) s'écarte de ±14 h des instants
 * vrais : la nouvelle lune d'août 2026 (12/08 17:37 UTC) était affichée le
 * 13/08. L'API FarmSense, dont l'âge renvoyé a le même défaut, est abandonnée
 * au profit du calcul local exact (plus de dépendance réseau ni timeout 5 s).
 */

// ── Types ──────────────────────────────────────────────────

export type TypeJour = 'feuille' | 'fruit' | 'racine' | 'fleur' | 'repos'

export interface JourLunaire {
  date: string           // YYYY-MM-DD
  phase: string          // Nom de la phase (Nouvelle Lune, etc.)
  phaseIndex: number     // 0-7 (0=nouvelle lune, 4=pleine lune)
  illumination: number   // 0-100 %
  age: number            // Jours depuis nouvelle lune (0-29.5)
  emoji: string          // 🌑🌒🌓🌔🌕🌖🌗🌘
  typeJour: TypeJour
  conseil: string        // Conseil du jour
  conseilVerger: string  // Conseil arboriculture (plantation, taille, greffe)
  couleur: string        // Couleur CSS pour le type de jour
}

export interface CalendrierLunaire {
  year: number
  month: number
  jours: JourLunaire[]
}

// ── Constantes ─────────────────────────────────────────────

const PHASE_EMOJIS: Record<number, string> = {
  0: '🌑', // Nouvelle Lune
  1: '🌒', // Premier croissant
  2: '🌓', // Premier quartier
  3: '🌔', // Gibbeuse croissante
  4: '🌕', // Pleine Lune
  5: '🌖', // Gibbeuse décroissante
  6: '🌗', // Dernier quartier
  7: '🌘', // Dernier croissant
}

const PHASE_NOMS: Record<number, string> = {
  0: 'Nouvelle Lune',
  1: 'Premier croissant',
  2: 'Premier quartier',
  3: 'Gibbeuse croissante',
  4: 'Pleine Lune',
  5: 'Gibbeuse décroissante',
  6: 'Dernier quartier',
  7: 'Dernier croissant',
}

const TYPE_JOUR_CONFIG: Record<TypeJour, { couleur: string; conseil: string }> = {
  feuille: {
    couleur: '#22c55e', // green-500
    conseil: 'Jour feuille : idéal pour semer et planter les légumes-feuilles (salades, épinards, choux, aromates).',
  },
  fruit: {
    couleur: '#f97316', // orange-500
    conseil: 'Jour fruit : idéal pour semer et récolter les légumes-fruits (tomates, courgettes, haricots, pois).',
  },
  racine: {
    couleur: '#92400e', // amber-800
    conseil: 'Jour racine : idéal pour semer et récolter les légumes-racines (carottes, radis, pommes de terre, oignons).',
  },
  fleur: {
    couleur: '#ec4899', // pink-500
    conseil: 'Jour fleur : idéal pour semer et planter les fleurs, brocolis, choux-fleurs et artichauts.',
  },
  repos: {
    couleur: '#9ca3af', // gray-400
    conseil: 'Jour de repos lunaire : éviter les semis et plantations. Bon pour le désherbage et le repos du jardin.',
  },
}

// ── Cache mémoire (TTL 7 jours) ──────────────────────────

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const cache = new Map<string, { data: JourLunaire; cachedAt: number }>()

function getCached(dateStr: string): JourLunaire | null {
  const entry = cache.get(dateStr)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(dateStr)
    return null
  }
  return entry.data
}

function setCache(dateStr: string, data: JourLunaire): void {
  cache.set(dateStr, { data, cachedAt: Date.now() })
}

// ── Calcul local des phases lunaires (syzygies vraies) ─────

const SYNODIC_PERIOD = 29.53059
const REF_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14)
const JOUR_MS = 24 * 60 * 60 * 1000
const D2R = Math.PI / 180

function jdeVersMs(jde: number): number {
  return (jde - 2440587.5) * 86400000
}

/**
 * Instant vrai (ms epoch) de la phase de rang k (Meeus ch. 49) :
 * k entier = nouvelle lune, k+0,25 premier quartier, k+0,5 pleine lune,
 * k+0,75 dernier quartier. k=0 ≈ nouvelle lune du 6 janvier 2000.
 */
export function instantPhaseVraie(k: number): number {
  const T = k / 1236.85
  let jde =
    2451550.09766 + 29.530588861 * k + 0.00015437 * T * T -
    0.00000015 * T * T * T + 0.00000000073 * T * T * T * T
  const E = 1 - 0.002516 * T - 0.0000074 * T * T
  const M = (2.5534 + 29.1053567 * k - 0.0000014 * T * T) * D2R
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T * T * T) * D2R
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T * T * T) * D2R
  const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T * T) * D2R

  const frac = ((k % 1) + 1) % 1
  const estSyzygie = frac < 1e-9 || Math.abs(frac - 0.5) < 1e-9
  if (estSyzygie) {
    const nm = frac < 1e-9 // nouvelle lune vs pleine lune (coefficients propres)
    jde +=
      (nm ? -0.4072 : -0.40614) * Math.sin(Mp) +
      (nm ? 0.17241 : 0.17302) * E * Math.sin(M) +
      (nm ? 0.01608 : 0.01614) * Math.sin(2 * Mp) +
      (nm ? 0.01039 : 0.01043) * Math.sin(2 * F) +
      (nm ? -0.00739 : -0.00734) * E * Math.sin(Mp - M) +
      (nm ? 0.00514 : 0.00515) * E * Math.sin(Mp + M) +
      (nm ? 0.00208 : 0.00209) * E * E * Math.sin(2 * M) -
      0.00111 * Math.sin(Mp - 2 * F) -
      0.00057 * Math.sin(Mp + 2 * F) +
      0.00056 * E * Math.sin(2 * Mp + M) -
      0.00042 * Math.sin(3 * Mp) +
      0.00042 * E * Math.sin(M + 2 * F) +
      0.00038 * E * Math.sin(M - 2 * F) -
      0.00024 * E * Math.sin(2 * Mp - M) -
      0.00017 * Math.sin(Om)
  } else {
    jde +=
      -0.62801 * Math.sin(Mp) +
      0.17172 * E * Math.sin(M) -
      0.01183 * E * Math.sin(Mp + M) +
      0.00862 * Math.sin(2 * Mp) +
      0.00804 * Math.sin(2 * F) +
      0.00454 * E * Math.sin(Mp - M) +
      0.00204 * E * E * Math.sin(2 * M) -
      0.0018 * Math.sin(Mp - 2 * F) -
      0.0007 * Math.sin(Mp + 2 * F) -
      0.0004 * Math.sin(3 * Mp) -
      0.00034 * E * Math.sin(2 * Mp - M) +
      0.00032 * E * Math.sin(M + 2 * F) +
      0.00032 * E * Math.sin(M - 2 * F) -
      0.00028 * E * E * Math.sin(Mp + 2 * M) +
      0.00027 * E * Math.sin(2 * Mp + M) -
      0.00017 * Math.sin(Om)
    const W =
      0.00306 - 0.00038 * E * Math.cos(M) + 0.00026 * Math.cos(Mp) -
      0.00002 * Math.cos(Mp - M) + 0.00002 * Math.cos(Mp + M) + 0.00002 * Math.cos(2 * F)
    jde += Math.abs(frac - 0.25) < 1e-9 ? W : -W
  }
  return jdeVersMs(jde)
}

type EvenementLunaire = { index: 0 | 2 | 4 | 6; t: number }

/** Les 4 phases vraies des cycles k-1, k et k+1 entourant l'instant donné. */
function evenementsAutour(dateMs: number): EvenementLunaire[] {
  const k0 = Math.floor((dateMs - REF_NEW_MOON_MS) / (SYNODIC_PERIOD * JOUR_MS))
  const evts: EvenementLunaire[] = []
  for (const k of [k0 - 1, k0, k0 + 1]) {
    evts.push({ index: 0, t: instantPhaseVraie(k) })
    evts.push({ index: 2, t: instantPhaseVraie(k + 0.25) })
    evts.push({ index: 4, t: instantPhaseVraie(k + 0.5) })
    evts.push({ index: 6, t: instantPhaseVraie(k + 0.75) })
  }
  return evts.sort((a, b) => a.t - b.t)
}

/**
 * Phase du jour civil contenant `midiLocal` (l'appelant ancre chaque jour à
 * midi local). Règle d'icône : un jour porte l'icône d'un événement (nouvelle
 * lune, quartiers, pleine lune) si son instant VRAI tombe dans la journée
 * civile [midi−12 h, midi+12 h) ; sinon phase intermédiaire, déterminée par le
 * dernier événement écoulé. L'âge est recalé sur la dernière nouvelle lune
 * vraie (l'ancien âge moyen dérivait de ±14 h).
 */
export function phaseVraieDuJour(midiLocal: Date): { phaseIndex: number; age: number; illumination: number } {
  const midi = midiLocal.getTime()
  const debutJour = midi - JOUR_MS / 2
  const finJour = midi + JOUR_MS / 2
  const evts = evenementsAutour(midi)

  const nmAvant = [...evts].reverse().find((e) => e.index === 0 && e.t <= midi)
  const nmApres = evts.find((e) => e.index === 0 && e.t > midi)
  const cycleMs = nmAvant && nmApres ? nmApres.t - nmAvant.t : SYNODIC_PERIOD * JOUR_MS
  const age = nmAvant ? (midi - nmAvant.t) / JOUR_MS : 0
  const illumination = Math.round(((1 - Math.cos(2 * Math.PI * ((midi - (nmAvant?.t ?? midi)) / cycleMs))) / 2) * 100)

  const duJour = evts.filter((e) => e.t >= debutJour && e.t < finJour)
  if (duJour.length > 0) {
    const plusProche = duJour.reduce((a, b) => (Math.abs(a.t - midi) <= Math.abs(b.t - midi) ? a : b))
    return { phaseIndex: plusProche.index, age, illumination }
  }
  const precedent = [...evts].reverse().find((e) => e.t <= midi)
  return { phaseIndex: precedent ? (precedent.index + 1) % 8 : 1, age, illumination }
}

// ── Détermination du type de jour ─────────────────────────

/**
 * Détermine le type de jour jardinage selon l'âge lunaire
 * Basé sur le cycle synodique simplifié :
 *
 * Nouvelle Lune (0j) → Premier quartier (~7.4j) : Feuille + Fleur (montante)
 * Premier quartier → Pleine Lune (~14.8j) : Fruit (montante forte)
 * Pleine Lune → Dernier quartier (~22.1j) : Racine (descendante)
 * Dernier quartier → Nouvelle Lune (~29.5j) : Repos (descendante fin)
 *
 * Jours de nœuds lunaires (transitions de phase) : Repos
 */
export function getTypeJour(age: number): TypeJour {
  const synodicPeriod = SYNODIC_PERIOD

  // Jours de transition (nœuds) : ±0.5 jour autour des changements de phase
  const quarterDay = synodicPeriod / 4
  for (let i = 0; i < 4; i++) {
    const nodeDay = quarterDay * i
    if (Math.abs(age - nodeDay) < 0.5 || Math.abs(age - synodicPeriod) < 0.5) {
      return 'repos'
    }
  }

  // Phases
  if (age < quarterDay) {
    // Nouvelle Lune → Premier quartier : alternance feuille/fleur
    return age % 2 < 1 ? 'feuille' : 'fleur'
  } else if (age < quarterDay * 2) {
    // Premier quartier → Pleine Lune : fruit
    return 'fruit'
  } else if (age < quarterDay * 3) {
    // Pleine Lune → Dernier quartier : racine
    return 'racine'
  } else {
    // Dernier quartier → Nouvelle Lune : repos / feuille légère
    return 'repos'
  }
}

/**
 * Phase lunaire pour une date (attendue ancrée à midi local par l'appelant).
 * Calcul local exact — plus d'appel réseau (cf. en-tête du fichier).
 */
export async function fetchMoonPhase(date: Date): Promise<JourLunaire> {
  // Jour local : toISOString() renverrait le jour UTC, soit la veille entre
  // minuit et 2 h en heure d'été française.
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  // Vérifier le cache
  const cached = getCached(dateStr)
  if (cached) return cached

  const { phaseIndex, age, illumination } = phaseVraieDuJour(date)
  const phaseName = PHASE_NOMS[phaseIndex] || 'Inconnue'

  const typeJour = getTypeJour(age)
  const config = TYPE_JOUR_CONFIG[typeJour]

  // Verger : la moitié croissante du cycle favorise greffes et semis, la
  // moitié décroissante plantation, taille et bouturage.
  // QA cmsjh8u71 — un jour « repos » (nœud ou fin de cycle) affichait à la fois
  // « éviter les plantations » (conseil jardin) et « favorable à la plantation »
  // (conseil verger). Le conseil verger doit respecter le repos lunaire.
  const conseilVerger = typeJour === 'repos'
    ? 'Verger — jour de repos lunaire : reporter plantation, taille et greffe au prochain jour favorable.'
    : age < SYNODIC_PERIOD / 2
      ? 'Verger — lune croissante : greffes et semis favorisés. Réserver plantation et taille des arbres à la lune décroissante.'
      : 'Verger — lune décroissante : période favorable à la plantation, à la taille et au bouturage des arbres et arbustes.'

  const jour: JourLunaire = {
    date: dateStr,
    phase: phaseName,
    phaseIndex,
    illumination,
    age: Math.round(age * 10) / 10,
    emoji: PHASE_EMOJIS[phaseIndex] || '🌑',
    typeJour,
    conseil: config.conseil,
    conseilVerger,
    couleur: config.couleur,
  }

  setCache(dateStr, jour)
  return jour
}

/**
 * Récupère le calendrier lunaire complet pour un mois
 */
export async function getLunarCalendar(year: number, month: number): Promise<CalendrierLunaire> {
  const daysInMonth = new Date(year, month, 0).getDate()
  const jours: JourLunaire[] = []

  // Récupérer toutes les phases du mois
  // On fait les appels séquentiellement pour éviter le rate-limiting
  // mais on utilise le calcul local en batch si l'API échoue
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day, 12) // midi pour éviter les problèmes de timezone
    const jour = await fetchMoonPhase(date)
    jours.push(jour)
  }

  return { year, month, jours }
}

/**
 * Récupère la phase lunaire du jour (pour le widget)
 *
 * QA cmsjjjfl2 — passé minuit (ex. 00h43 Paris), `new Date()` vaut la veille
 * en UTC : l'âge lunaire et l'illumination étaient calculés pour le jour
 * précédent (30 % au lieu de ~22 %), alors que le calendrier ancre chaque
 * jour à midi. On aligne « aujourd'hui » sur midi LOCAL : le libellé de jour
 * (dateStr, déjà local) et le calcul d'âge portent ainsi tous deux sur la
 * même journée civile, quelle que soit l'heure de consultation.
 */
export async function getMoonPhaseToday(): Promise<JourLunaire> {
  const now = new Date()
  const midiLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
  return fetchMoonPhase(midiLocal)
}
