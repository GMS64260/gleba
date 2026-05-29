/**
 * Helpers pour l'Assistant Maraîcher
 * Calculs de dates, estimations de rendement, vérification de stock
 */

import { startOfYear, addWeeks, startOfWeek, getWeek, getYear } from 'date-fns'

/**
 * Calcule la date correspondant à une semaine donnée d'une annee
 * Utilise date-fns pour un calcul précis (ISO semaines)
 */
export function calculerDateDepuisSemaine(annee: number, semaine: number): Date {
  const debut = startOfYear(new Date(annee, 0, 1))
  const date = addWeeks(debut, semaine - 1)
  return startOfWeek(date, { weekStartsOn: 1 }) // Lundi comme début de semaine
}

/**
 * Obtient le numéro de semaine ISO à partir d'une date
 */
export function getSemaineDepuisDate(date: Date): number {
  return getWeek(date, { weekStartsOn: 1 })
}

/**
 * Date d'une semaine en respectant la CHRONOLOGIE d'un itinéraire : si la semaine
 * cible est antérieure à une semaine de référence (l'étape précédente), l'étape
 * tombe l'année suivante. Indispensable pour les ITP qui chevauchent deux années
 * (ex : semis semaine 31 en août → récolte semaine 2 en janvier de l'année +1).
 * `calculerDateDepuisSemaine` gère naturellement les semaines > 52 (débordement
 * sur l'année suivante via addWeeks).
 */
export function dateSemaineChrono(
  annee: number,
  semaine: number,
  semaineReference?: number | null
): Date {
  let s = Math.max(Math.round(semaine), 1)
  if (semaineReference != null) {
    while (s < semaineReference) s += 52
  }
  return calculerDateDepuisSemaine(annee, s)
}

/**
 * Calcule les dates de culture à partir d'un ITP, en cascade chronologique
 * (semis → plantation → récolte). Chaque étape dont la semaine « recule » par
 * rapport à la précédente passe à l'année suivante.
 */
export function calculerDatesCulture(
  itp: {
    semaineSemis?: number | null
    semainePlantation?: number | null
    semaineRecolte?: number | null
    dureePepiniere?: number | null
    dureeCulture?: number | null
  },
  annee: number,
  decalage: number = 0 // Semaines de décalage par rapport à l'ITP
): {
  dateSemis: Date | null
  datePlantation: Date | null
  dateRecolte: Date | null
} {
  let dateSemis: Date | null = null
  let datePlantation: Date | null = null
  let dateRecolte: Date | null = null

  const sSemis = itp.semaineSemis ? Math.max(itp.semaineSemis + decalage, 1) : null
  const sPlant = itp.semainePlantation ? Math.max(itp.semainePlantation + decalage, 1) : null
  const sRec = itp.semaineRecolte ? Math.max(itp.semaineRecolte + decalage, 1) : null

  if (sSemis != null) dateSemis = calculerDateDepuisSemaine(annee, sSemis)

  // Semaine "absolue" de plantation (≥ semis)
  let semPlantAbs: number | null = null
  if (sPlant != null) {
    semPlantAbs = sPlant
    if (sSemis != null) while (semPlantAbs < sSemis) semPlantAbs += 52
    datePlantation = calculerDateDepuisSemaine(annee, semPlantAbs)
  }

  // Récolte ≥ plantation (ou semis si pas de plantation)
  if (sRec != null) {
    const ref = semPlantAbs ?? sSemis
    let semRecAbs = sRec
    if (ref != null) while (semRecAbs < ref) semRecAbs += 52
    dateRecolte = calculerDateDepuisSemaine(annee, semRecAbs)
  }

  return { dateSemis, datePlantation, dateRecolte }
}

/**
 * Estime le nombre de plants en fonction de la surface et de l'espacement.
 * Compat : retourne 0 si un input manque (utilisé par l'assistant).
 */
export function estimerNombrePlants(
  longueur: number, // mètres
  largeur: number, // mètres
  nbRangs: number,
  espacement: number // cm
): number {
  if (!longueur || !nbRangs || !espacement) return 0
  const espacementM = espacement / 100
  const plantsParRang = Math.floor(longueur / espacementM)
  return plantsParRang * nbRangs
}

/**
 * BUG-10 — Variante stricte : retourne `null` quand une donnée d'entrée
 * manque, au lieu de 0. Utilisé par les formulaires de création/édition
 * de culture pour distinguer « vraiment 0 plant » (impossible en pratique)
 * de « calcul impossible — inputs incomplets ». Sans ça, le formulaire
 * gardait l'ancienne valeur de `quantite` quand l'utilisateur vidait un
 * champ, ce qui rendait la liste et le détail incohérents (cf. BUG-11).
 */
export function estimerNombrePlantsStrict(
  longueur: number | null | undefined,
  nbRangs: number | null | undefined,
  espacement: number | null | undefined
): number | null {
  if (!longueur || !nbRangs || !espacement || espacement <= 0) return null
  const plantsParRang = Math.floor((longueur * 100) / espacement)
  return plantsParRang * nbRangs
}

/**
 * Estime le rendement attendu
 */
export function estimerRendement(
  rendementKgM2: number | null | undefined,
  surface: number // m²
): number {
  if (!rendementKgM2 || !surface) return 0
  return rendementKgM2 * surface
}

/**
 * Vérifie si le stock de semences est suffisant
 */
export function verifierStockSemences(
  stockGraines: number | null | undefined, // grammes
  nbPlants: number,
  nbGrainesParPlant: number | null | undefined
): {
  suffisant: boolean
  stockActuel: number
  besoin: number
} {
  const stock = stockGraines || 0
  const graines = nbGrainesParPlant || 1
  const besoin = nbPlants * graines

  return {
    suffisant: stock >= besoin,
    stockActuel: stock,
    besoin,
  }
}

/**
 * Retourne les especes recommandées pour la saison actuelle
 * Basé sur les ITPs dont la semaine de semis est proche
 */
export function filtrerEspecesSaison<T extends {
  itps?: Array<{
    semaineSemis?: number | null
    semainePlantation?: number | null
  }>
}>(
  especes: T[],
  semaineCourante: number,
  tolerance: number = 4 // +/- 4 semaines
): T[] {
  return especes.filter(espece => {
    if (!espece.itps?.length) return false
    return espece.itps.some(itp => {
      const sSemis = itp.semaineSemis
      const sPlant = itp.semainePlantation

      // Vérifie si semis ou plantation est proche
      if (sSemis) {
        const diff = Math.abs(sSemis - semaineCourante)
        if (diff <= tolerance || diff >= 52 - tolerance) return true
      }
      if (sPlant) {
        const diff = Math.abs(sPlant - semaineCourante)
        if (diff <= tolerance || diff >= 52 - tolerance) return true
      }
      return false
    })
  })
}

/**
 * Formate une semaine en texte
 */
export function formatSemaine(semaine: number | null | undefined): string {
  if (!semaine) return '-'
  return `S${semaine.toString().padStart(2, '0')}`
}

/**
 * Détermine si l'espèce a besoin d'irrigation automatique
 * Basé sur besoinEau >= 3 ou irrigation === "Eleve"
 */
export function necesiteIrrigation(espece: {
  besoinEau?: number | null
  irrigation?: string | null
}): boolean {
  if (espece.besoinEau && espece.besoinEau >= 3) return true
  if (espece.irrigation?.toLowerCase() === 'eleve' || espece.irrigation?.toLowerCase() === 'élevé') return true
  return false
}

/**
 * Catégories d'especes avec emojis
 */
export const CATEGORIES_ESPECES = {
  legume: { label: 'Légume', emoji: '🥬' },
  aromatique: { label: 'Aromatique', emoji: '🌿' },
  engrais_vert: { label: 'Engrais vert', emoji: '🌱' },
  fruit: { label: 'Fruit', emoji: '🍎' },
  autre: { label: 'Autre', emoji: '🌾' },
} as const

/**
 * Types de planche
 */
export const TYPES_PLANCHE = [
  { value: 'Plein champ', label: 'Plein champ' },
  { value: 'Serre', label: 'Serre' },
  { value: 'Tunnel', label: 'Tunnel' },
  { value: 'Châssis', label: 'Châssis' },
] as const

/**
 * Types d'irrigation
 */
export const TYPES_IRRIGATION = [
  { value: 'Goutte-à-goutte', label: 'Goutte-à-goutte' },
  { value: 'Aspersion', label: 'Aspersion' },
  { value: 'Manuel', label: 'Manuel' },
  { value: 'Aucun', label: 'Aucun' },
] as const

/**
 * Dimensions par défaut pour une nouvelle planche
 */
export const PLANCHE_DEFAUT_LARGEUR = 0.80
export const PLANCHE_DEFAUT_LONGUEUR = 10

/**
 * Presets de dimensions de planches
 */
export const PRESETS_DIMENSIONS_PLANCHE = [
  { label: 'Standard (0.80 x 10m)', largeur: 0.80, longueur: 10 },
  { label: 'Large (1.20 x 15m)', largeur: 1.20, longueur: 15 },
  { label: 'Petite (0.60 x 5m)', largeur: 0.60, longueur: 5 },
] as const

/**
 * Niveaux de difficulté
 */
export const NIVEAUX_DIFFICULTE = {
  Facile: { label: 'Facile', color: 'text-green-600' },
  Moyen: { label: 'Moyen', color: 'text-amber-600' },
  Difficile: { label: 'Difficile', color: 'text-red-600' },
} as const
