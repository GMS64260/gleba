/**
 * Des clés reçues aux grandeurs Gleba. Chaque fabricant nomme ses valeurs à sa
 * façon (`TempC_SHT`, `temperature`, `water_SOIL`…) et la même clé change de
 * sens d'un modèle à l'autre (`temperature` d'une sonde de sol). Ordre de
 * résolution, du plus sûr au plus général :
 *   1. correspondance saisie par l'utilisateur sur le capteur (null = ignorer) ;
 *   2. profil du modèle annoncé par le serveur de réseau ;
 *   3. dictionnaire commun, clés EXACTES seulement ;
 *   4. la clé est elle-même une grandeur Gleba, pour le format générique
 *      SEULEMENT : c'est l'outil de la ferme qui écrit pour Gleba. Un décodeur
 *      TTN qui rend `distance` en cm ou `poids` en g n'a pas signé cette unité.
 * Une clé numérique qu'aucune règle ne reconnaît est rendue « inconnue » pour
 * être rattachée à la main : jamais d'heuristique silencieuse.
 */
import { controlerValeur, estGrandeur, GRANDEURS, type Grandeur } from "./grandeurs"

interface Regle {
  grandeur: Grandeur
  /** Conversion vers l'unité canonique, si la clé n'y est pas déjà. */
  facteur?: number
}

/**
 * Clés dont le NOM porte le sens et l'unité, quel que soit le fabricant.
 * Une clé ambiguë n'y entre pas : `temperature` (air ou sol ?), `battery`
 * (% ou V ?), `weight` (g ou kg ?), `wind_speed` (m/s ou km/h ?),
 * `pressure` (Pa ou hPa ?) restent inconnues tant qu'un profil ou
 * l'utilisateur ne les a pas tranchées (relecture du 2026-10-23 : « battery »
 * à 3,6 V s'affichait « batterie 4 % »). Les noms propres à Meshtastic iront
 * dans son profil (lot 2).
 */
const DICTIONNAIRE_COMMUN: Record<string, Regle> = {
  relative_humidity: { grandeur: "humidite_air" },
  barometric_pressure: { grandeur: "pression" },
  soil_moisture: { grandeur: "humidite_sol" },
  soil_temperature: { grandeur: "temperature_sol" },
  lux: { grandeur: "luminosite" },
  illuminance: { grandeur: "luminosite" },
  wind_direction: { grandeur: "vent_direction" },
  rainfall_1h: { grandeur: "pluie_1h" },
  rainfall_24h: { grandeur: "pluie_24h" },
  battery_level: { grandeur: "batterie" },
  batteryLevel: { grandeur: "batterie" },
  BatV: { grandeur: "tension_batterie" },
  battery_voltage: { grandeur: "tension_batterie" },
}

/**
 * Profils par modèle, identifiés par la clé `marque/modèle` du Device
 * Repository de TTN (`version_ids.brand_id` / `model_id`) : posée d'office
 * pour un appareil TTN enregistré depuis le dépôt, choisie à l'écran sinon
 * (jamais déduite d'un libellé, comme le nom de profil libre de ChirpStack).
 * Clés relevées sur les décodeurs publiés ; à confirmer sur les charges
 * réelles du banc (lot 0 du plan).
 */
const PROFILS: Record<string, Record<string, Regle>> = {
  "dragino/lht65n": {
    TempC_SHT: { grandeur: "temperature_air" },
    Hum_SHT: { grandeur: "humidite_air" },
    BatV: { grandeur: "tension_batterie" },
  },
  "dragino/lse01": {
    temp_SOIL: { grandeur: "temperature_sol" },
    water_SOIL: { grandeur: "humidite_sol" },
    conduct_SOIL: { grandeur: "conductivite_sol" },
    Bat: { grandeur: "tension_batterie" },
  },
  // Sonde de sol : sa `temperature` est celle du sol, pas de l'air.
  "milesight-iot/em500-smtc": {
    temperature: { grandeur: "temperature_sol" },
    moisture: { grandeur: "humidite_sol" },
    conductivity: { grandeur: "conductivite_sol" },
    battery: { grandeur: "batterie" },
  },
}

export const LIBELLES_PROFILS: Record<string, string> = {
  "dragino/lht65n": "Dragino LHT65N (température et humidité de l'air)",
  "dragino/lse01": "Dragino LSE01 (sonde de sol)",
  "milesight-iot/em500-smtc": "Milesight EM500-SMTC (sonde de sol)",
}

export const PROFILS_IDS = Object.keys(PROFILS)

export function aProfil(modele: string | null | undefined): boolean {
  return !!modele && Object.prototype.hasOwnProperty.call(PROFILS, modele)
}

/** Seules ses propres clés comptent : `constructor` ou `toString` n'existent pas. */
function possede(objet: object, cle: string): boolean {
  return Object.prototype.hasOwnProperty.call(objet, cle)
}

const NOMBRE_STRICT = /^-?\d+(\.\d+)?$/
const PROFONDEUR_MAX = 3
/** Bornes d'une charge : au-delà, les clés suivantes sont laissées de côté. */
export const CLES_MAX = 64
export const LONGUEUR_CLE_MAX = 120

/**
 * Valeurs numériques d'une charge décodée, clés imbriquées jointes par un
 * point (`sensors.temp`). Les décodeurs Dragino rendent souvent des nombres en
 * texte (« 23.45 ») : acceptés s'ils sont strictement numériques, jamais
 * « 1234 mm ». Tableaux, booléens et textes sont laissés de côté.
 */
export function aplatir(objet: unknown): Array<[string, number]> {
  const sortie: Array<[string, number]> = []
  const parcourir = (o: unknown, prefixe: string, profondeur: number) => {
    if (!o || typeof o !== "object" || Array.isArray(o) || profondeur > PROFONDEUR_MAX) return
    for (const [cle, valeur] of Object.entries(o as Record<string, unknown>)) {
      if (sortie.length >= CLES_MAX) return
      const chemin = prefixe ? `${prefixe}.${cle}` : cle
      if (chemin.length > LONGUEUR_CLE_MAX) continue
      if (typeof valeur === "number" && Number.isFinite(valeur)) sortie.push([chemin, valeur])
      else if (typeof valeur === "string" && NOMBRE_STRICT.test(valeur.trim())) sortie.push([chemin, Number(valeur)])
      else if (valeur && typeof valeur === "object") parcourir(valeur, chemin, profondeur + 1)
    }
  }
  parcourir(objet, "", 0)
  return sortie
}

const CLES_LATITUDE = ["latitude", "lat"]
const CLES_LONGITUDE = ["longitude", "lng", "lon"]

/** Position portée par la charge (traceur GPS), au premier niveau seulement. */
export function extrairePosition(objet: unknown): { lat: number; lng: number } | null {
  if (!objet || typeof objet !== "object" || Array.isArray(objet)) return null
  const o = objet as Record<string, unknown>
  const lire = (cles: string[]) => {
    for (const c of cles) {
      const v = typeof o[c] === "string" ? Number(o[c]) : o[c]
      if (typeof v === "number" && Number.isFinite(v)) return v
    }
    return null
  }
  const lat = lire(CLES_LATITUDE)
  const lng = lire(CLES_LONGITUDE)
  if (lat === null || lng === null) return null
  // 0,0 est le « pas de fix » de nombreux traceurs, pas un point du golfe de Guinée.
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null
  return { lat, lng }
}

/** Clés de position : lues par `extrairePosition`, ni grandeur ni inconnue. */
export const CLES_POSITION = new Set([...CLES_LATITUDE, ...CLES_LONGITUDE])

export interface MesureResolue {
  cle: string
  grandeur: Grandeur
  valeur: number
  unite: string
}

export interface RefusMesure {
  cle: string
  valeur: number
  raison: string
}

export interface ResolutionMesures {
  mesures: MesureResolue[]
  inconnues: string[]
  refus: RefusMesure[]
}

export type Correspondances = Record<string, Grandeur | null>

/** Lit les surcharges stockées sur le capteur (JSON libre en base). */
export function lireCorrespondances(brut: unknown): Correspondances {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {}
  const sortie: Correspondances = {}
  for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
    if (valeur === null) sortie[cle] = null
    else if (estGrandeur(valeur)) sortie[cle] = valeur
  }
  return sortie
}

export type SourceRegle = "manuelle" | "profil" | "dictionnaire" | "grandeur"

/**
 * Règle appliquée à une clé, et d'où elle vient (l'écran le montre).
 * `null` : clé ignorée à la demande de l'utilisateur ; `undefined` : inconnue.
 * `nomsGleba` : vrai pour le format générique seulement (règle 4).
 */
export function regleDe(
  cle: string,
  modele: string | null | undefined,
  correspondances: Correspondances,
  nomsGleba = false,
): (Regle & { source: SourceRegle }) | null | undefined {
  if (possede(correspondances, cle)) {
    const g = correspondances[cle]
    return g === null ? null : { grandeur: g, source: "manuelle" }
  }
  const profil = modele && possede(PROFILS, modele) ? PROFILS[modele] : undefined
  if (profil && possede(profil, cle)) return { ...profil[cle], source: "profil" }
  if (possede(DICTIONNAIRE_COMMUN, cle)) return { ...DICTIONNAIRE_COMMUN[cle], source: "dictionnaire" }
  if (nomsGleba && estGrandeur(cle)) return { grandeur: cle, source: "grandeur" }
  return undefined
}

/**
 * Résout les valeurs aplaties d'une trame. Une grandeur fournie deux fois dans
 * la même trame garde la première clé et refuse la suivante (en base, la clé
 * unique capteur + grandeur + instant n'en accepterait qu'une au hasard).
 */
export function resoudreMesures(
  valeurs: Array<[string, number]>,
  options: { modele?: string | null; correspondances?: Correspondances; nomsGleba?: boolean },
): ResolutionMesures {
  const correspondances = options.correspondances ?? {}
  const resultat: ResolutionMesures = { mesures: [], inconnues: [], refus: [] }
  const vues = new Map<Grandeur, string>()
  for (const [cle, brute] of valeurs) {
    if (CLES_POSITION.has(cle)) continue
    const regle = regleDe(cle, options.modele, correspondances, options.nomsGleba)
    if (regle === null) continue
    if (regle === undefined) {
      resultat.inconnues.push(cle)
      continue
    }
    const valeur = regle.facteur ? brute * regle.facteur : brute
    const controle = controlerValeur(regle.grandeur, valeur)
    if (!controle.ok) {
      resultat.refus.push({ cle, valeur: brute, raison: controle.raison })
      continue
    }
    const deja = vues.get(regle.grandeur)
    if (deja) {
      resultat.refus.push({ cle, valeur: brute, raison: `${GRANDEURS[regle.grandeur].libelle} déjà fournie par « ${deja} »` })
      continue
    }
    vues.set(regle.grandeur, cle)
    resultat.mesures.push({ cle, grandeur: regle.grandeur, valeur: controle.valeur, unite: GRANDEURS[regle.grandeur].unite })
  }
  return resultat
}
