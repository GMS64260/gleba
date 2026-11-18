"use client"

import { useCallback, useEffect, useState, type SetStateAction } from "react"
import { DEFAULT_LAYERS, type GardenLayers } from "@/components/garden/GardenView"
import { useExploitation } from "@/hooks/use-exploitation"

export function gardenLayersKey(tenantId: string): string {
  return `gleba_jardin_calques:${tenantId}`
}

function lireCalques(tenantId: string | null): GardenLayers {
  const layers = { ...DEFAULT_LAYERS }
  if (!tenantId) return layers
  try {
    const value: unknown = JSON.parse(localStorage.getItem(gardenLayersKey(tenantId)) ?? "null")
    if (value && typeof value === "object") {
      for (const key of Object.keys(layers) as (keyof GardenLayers)[]) {
        const choix = (value as Record<string, unknown>)[key]
        if (typeof choix === "boolean") layers[key] = choix
      }
    }
  } catch {
    // Stockage indisponible ou ancienne valeur invalide : garder le plan utilisable.
  }
  return layers
}

/** Préférence du plan liée à l'exploitation, jamais à l'acteur de la session brute. */
export function useGardenLayers() {
  const { contexte } = useExploitation()
  const tenantId = contexte?.tenantId ?? null
  const [etat, setEtat] = useState<{ tenantId: string | null; layers: GardenLayers }>({
    tenantId: null,
    layers: DEFAULT_LAYERS,
  })

  useEffect(() => {
    setEtat({ tenantId, layers: lireCalques(tenantId) })
  }, [tenantId])

  useEffect(() => {
    // Attendre la lecture de la bonne exploitation avant toute écriture.
    if (!tenantId || etat.tenantId !== tenantId) return
    try {
      localStorage.setItem(gardenLayersKey(tenantId), JSON.stringify(etat.layers))
    } catch {
      console.warn("Impossible de conserver les calques du plan sur cet appareil.")
    }
  }, [tenantId, etat])

  const setLayers = useCallback((action: SetStateAction<GardenLayers>) => {
    setEtat(previous => {
      const layers = previous.tenantId === tenantId ? previous.layers : lireCalques(tenantId)
      return { tenantId, layers: typeof action === "function" ? action(layers) : action }
    })
  }, [tenantId])

  return [etat.tenantId === tenantId ? etat.layers : DEFAULT_LAYERS, setLayers] as const
}
