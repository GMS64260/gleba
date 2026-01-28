/**
 * Types pour le système de rotation des cultures
 */

export interface CultureHistory {
  id: number
  annee: number
  especeId: string
  especeNom: string
  familleId: string | null
  familleNom: string | null
  familleCouleur: string | null
  dateSemis: Date | null
  datePlantation: Date | null
  dateRecolte: Date | null
  terminee: string | null
  etat: string
  recoltes: {
    date: Date
    quantite: number
  }[]
  totalRecolte: number
}

export interface FertilisationHistory {
  id: number
  date: Date
  fertilisantId: string
  fertilisantNom: string
  quantite: number
  n: number | null
  p: number | null
  k: number | null
}

export interface PlancheHistory {
  plancheId: string
  cultures: CultureHistory[]
  fertilisations: FertilisationHistory[]
  yearsAvailable: number[]
}

export interface BlockedFamily {
  familleId: string
  familleNom: string
  familleCouleur: string | null
  lastYear: number
  intervalle: number
  yearsRemaining: number
  reason: string
}

export interface RecommendedFamily {
  familleId: string
  familleNom: string
  familleCouleur: string | null
  reason: string
  score: number // 0-100
}

export type SoilStatus = 'depleted' | 'normal' | 'enriched'

export interface SoilAnalysis {
  estimatedN: SoilStatus
  estimatedP: SoilStatus
  estimatedK: SoilStatus
  lastHeavyFeeder: { year: number; especeId: string } | null
  suggestion: string
}

export interface EspeceAdvice {
  especeId: string
  familleId: string | null
  status: 'safe' | 'warning' | 'blocked'
  message: string
  details: string[]
}

export interface RotationAdvice {
  plancheId: string
  targetYear: number
  recentCultures: {
    annee: number
    familleId: string | null
    especeId: string
    besoinN: number | null
  }[]
  blockedFamilies: BlockedFamily[]
  recommendedFamilies: RecommendedFamily[]
  soilStatus: SoilAnalysis
  especeAdvice?: EspeceAdvice
}
