"use client"

import { useCallback, useEffect, useState, type SetStateAction } from "react"
import { DEFAULT_LAYERS, type GardenLayers } from "@/components/garden/GardenView"
import { useExploitation } from "@/hooks/use-exploitation"

export function gardenLayersKey(tenantId: string): string {
  return `gleba_jardin_calques:${tenantId}`
}

function lireCalques(tenantId: string | null, base: GardenLayers = DEFAULT_LAYERS): GardenLayers {
  const layers = { ...base }
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
      // Relire le stockage : un autre onglet a pu changer un autre calque depuis
      // l'ouverture, et ce réglage était annulé (équipe debug, D235).
      const layers = lireCalques(tenantId, previous.tenantId === tenantId ? previous.layers : DEFAULT_LAYERS)
      return { tenantId, layers: typeof action === "function" ? action(layers) : action }
    })
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) return
    const cle = gardenLayersKey(tenantId)
    const synchroniser = (e: StorageEvent) => {
      if (e.key === cle) setEtat({ tenantId, layers: lireCalques(tenantId) })
    }
    window.addEventListener("storage", synchroniser)
    return () => window.removeEventListener("storage", synchroniser)
  }, [tenantId])

  return [etat.tenantId === tenantId ? etat.layers : DEFAULT_LAYERS, setLayers] as const
}
