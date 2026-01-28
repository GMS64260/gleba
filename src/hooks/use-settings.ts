/**
 * Hook pour accéder aux paramètres de l'application
 */

import { useState, useEffect } from 'react'

const SETTINGS_KEY = 'potaleger_settings'

export interface GardenSettings {
  // Dimensions du plan
  planWidth: number
  planHeight: number
  gridSize: number
  // Dimensions par défaut des planches
  defaultPlancheLargeur: number
  defaultPlancheLongueur: number
  // Couleurs
  plancheColor: string
  plancheSelectedColor: string
  gridColor: string
}

export const defaultSettings: GardenSettings = {
  planWidth: 50,
  planHeight: 30,
  gridSize: 1,
  defaultPlancheLargeur: 0.8,
  defaultPlancheLongueur: 10,
  plancheColor: '#8B5A2B',
  plancheSelectedColor: '#22c55e',
  gridColor: '#e5e7eb',
}

export function useSettings(): GardenSettings {
  const [settings, setSettings] = useState<GardenSettings>(defaultSettings)

  useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setSettings({ ...defaultSettings, ...parsed })
      } catch {
        // Ignorer les erreurs de parsing
      }
    }
  }, [])

  return settings
}

export function getSettings(): GardenSettings {
  if (typeof window === 'undefined') return defaultSettings

  const stored = localStorage.getItem(SETTINGS_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      return { ...defaultSettings, ...parsed }
    } catch {
      // Ignorer les erreurs de parsing
    }
  }
  return defaultSettings
}
