/**
 * Types TypeScript pour Gleba
 * Complètent les types générés par Prisma
 */

// Types calculés pour les cultures (non stockés en BDD)
export type CultureType =
  | 'Erreur'
  | 'Vivace'
  | 'Semis pépinière'
  | 'Semis en place'
  | 'Plant'
  | 'Compagne'
  | 'Engrais vert'

export type CultureEtat =
  | 'Planifiée'
  | 'Semée'
  | 'Plantée'
  | 'En récolte'
  | 'Terminée'
  | 'Annulée'

// Couleurs UI par défaut
export const COULEURS_ETAT: Record<CultureEtat, string> = {
  'Planifiée': '#3b82f6', // blue-500
  'Semée': '#22c55e', // green-500
  'Plantée': '#84cc16', // lime-500
  'En récolte': '#f59e0b', // amber-500
  'Terminée': '#6b7280', // gray-500
  'Annulée': '#ef4444', // red-500
}

// Type pour les semaines ISO (1-52)
export type SemaineISO = number & { __brand: 'SemaineISO' }

// Helper pour créer une semaine ISO valide
export function createSemaineISO(week: number): SemaineISO | null {
  if (week >= 1 && week <= 52) {
    return week as SemaineISO
  }
  return null
}

// Type pour les besoins (1-5)
export type NiveauBesoin = 1 | 2 | 3 | 4 | 5

// Type générique pour les filtres de table
export interface TableFilters {
  search?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  [key: string]: string | number | boolean | undefined
}

// Type pour les réponses paginées
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Type pour les erreurs API
export interface ApiError {
  message: string
  code?: string
  details?: Record<string, string[]>
}

// Type pour les options de select
export interface SelectOption {
  value: string
  label: string
  description?: string
}
