/**
 * Service calendrier lunaire pour le jardinage
 * Source primaire : FarmSense Moon Phase API (gratuit, sans clé)
 * Fallback : calcul astronomique local
 * https://farmsense.net/api/
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

// ── Calcul local des phases lunaires ──────────────────────
// Algorithme de Conway (précis à ~1 jour)
// Utilisé comme fallback si l'API FarmSense est down

function calculerPhaseLunaireLocale(date: Date): { phase: number; age: number; illumination: number } {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  // Algorithme basé sur le cycle synodique de 29.53059 jours
  // Référence : Nouvelle Lune du 6 janvier 2000
  const refNewMoon = new Date(2000, 0, 6, 18, 14).getTime()
  const synodicPeriod = 29.53059

  const daysSinceRef = (date.getTime() - refNewMoon) / (24 * 60 * 60 * 1000)
  const lunarAge = ((daysSinceRef % synodicPeriod) + synodicPeriod) % synodicPeriod

  // Phase index (0-7)
  const phaseIndex = Math.floor((lunarAge / synodicPeriod) * 8) % 8

  // Illumination approximative (sinusoïdale)
  const illumination = Math.round((1 - Math.cos(2 * Math.PI * lunarAge / synodicPeriod)) / 2 * 100)

  return {
    phase: phaseIndex,
    age: Math.round(lunarAge * 10) / 10,
    illumination,
  }
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
  const synodicPeriod = 29.53

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

// ── API FarmSense ─────────────────────────────────────────

const FARMSENSE_URL = 'https://api.farmsense.net/v1/moonphases/'

interface FarmSenseResponse {
  Error: number
  ErrorMsg: string
  Phase: string
  Moon: string[]
  Index: number
  Age: number
  Illumination: string
  AngularDiameter: number
  Distance: number
  DistanceToSun: number
}

/**
 * Récupère la phase lunaire pour une date via FarmSense
 * Fallback sur calcul local si l'API est indisponible
 */
export async function fetchMoonPhase(date: Date): Promise<JourLunaire> {
  const dateStr = date.toISOString().split('T')[0]

  // Vérifier le cache
  const cached = getCached(dateStr)
  if (cached) return cached

  let phaseIndex: number
  let age: number
  let illumination: number
  let phaseName: string

  try {
    // Timestamp Unix en secondes
    const unixTimestamp = Math.floor(date.getTime() / 1000)
    const url = `${FARMSENSE_URL}?d=${unixTimestamp}`

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) throw new Error(`FarmSense ${response.status}`)

    const data: FarmSenseResponse[] = await response.json()
    if (!data || data.length === 0 || data[0].Error !== 0) {
      throw new Error('FarmSense invalid response')
    }

    const moon = data[0]
    phaseIndex = moon.Index
    age = moon.Age
    illumination = Math.round(parseFloat(moon.Illumination) * 100)
    phaseName = PHASE_NOMS[phaseIndex] || moon.Phase
  } catch {
    // Fallback : calcul local
    const local = calculerPhaseLunaireLocale(date)
    phaseIndex = local.phase
    age = local.age
    illumination = local.illumination
    phaseName = PHASE_NOMS[phaseIndex] || 'Inconnue'
  }

  const typeJour = getTypeJour(age)
  const config = TYPE_JOUR_CONFIG[typeJour]

  const jour: JourLunaire = {
    date: dateStr,
    phase: phaseName,
    phaseIndex,
    illumination,
    age: Math.round(age * 10) / 10,
    emoji: PHASE_EMOJIS[phaseIndex] || '🌑',
    typeJour,
    conseil: config.conseil,
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
 */
export async function getMoonPhaseToday(): Promise<JourLunaire> {
  return fetchMoonPhase(new Date())
}
