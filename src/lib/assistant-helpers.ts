/**
 * Helpers pour l'Assistant Maraîcher
 * Calculs de dates, estimations de rendement, vérification de stock
 */

import { startOfYear, addWeeks, startOfWeek, getWeek, getYear } from 'date-fns'

/**
 * Calcule la date correspondant à une semaine donnée d'une année
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
 * Calcule les dates de culture à partir d'un ITP
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

  if (itp.semaineSemis) {
    const semaine = Math.min(Math.max(itp.semaineSemis + decalage, 1), 52)
    dateSemis = calculerDateDepuisSemaine(annee, semaine)
  }

  if (itp.semainePlantation) {
    const semaine = Math.min(Math.max(itp.semainePlantation + decalage, 1), 52)
    datePlantation = calculerDateDepuisSemaine(annee, semaine)
  }

  if (itp.semaineRecolte) {
    const semaine = Math.min(Math.max(itp.semaineRecolte + decalage, 1), 52)
    dateRecolte = calculerDateDepuisSemaine(annee, semaine)
  }

  return { dateSemis, datePlantation, dateRecolte }
}

/**
 * Estime le nombre de plants en fonction de la surface et de l'espacement
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
 * Retourne les espèces recommandées pour la saison actuelle
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
 * Catégories d'espèces avec emojis
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
 * Niveaux de difficulté
 */
export const NIVEAUX_DIFFICULTE = {
  Facile: { label: 'Facile', color: 'text-green-600' },
  Moyen: { label: 'Moyen', color: 'text-amber-600' },
  Difficile: { label: 'Difficile', color: 'text-red-600' },
} as const
