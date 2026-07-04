"use client"

/**
 * Couche d'affichage des parcelles sur la carte
 * Rend chaque parcelle en tant que polygone GeoJSON avec interaction
 */

import { useMemo, useCallback } from "react"
import { GeoJSON, Tooltip } from "react-leaflet"
import type { Layer, PathOptions, LeafletMouseEvent } from "leaflet"
import type { Feature, Geometry } from "geojson"

// Couleur par defaut pour les parcelles sans couleur definie
const DEFAULT_COULEUR = "#4ade80" // vert Tailwind green-400

export interface ParcelleGeoData {
  id: string
  nom: string
  geometry: string // GeoJSON string
  surface?: number | null
  commune?: string | null
  section?: string | null
  numero?: string | null
  usage?: string | null
  couleur?: string | null
  notes?: string | null
  typeSol?: string | null
}

interface ParcelleLayerProps {
  parcelles: ParcelleGeoData[]
  onSelect?: (parcelle: ParcelleGeoData) => void
  /** ID de la parcelle en cours d'édition (masquée dans la couche) */
  editingId?: string | null
}

/**
 * Parse securise d'une string GeoJSON en objet Feature
 */
function parseGeometry(geometryStr: string): Geometry | null {
  try {
    const parsed = JSON.parse(geometryStr)
    return parsed as Geometry
  } catch {
    console.warn("Geometrie GeoJSON invalide:", geometryStr.slice(0, 100))
    return null
  }
}

/**
 * Composant interne pour une parcelle individuelle
 * Necessaire car react-leaflet GeoJSON ne se met pas a jour facilement
 */
function ParcelleFeature({
  parcelle,
  onSelect,
}: {
  parcelle: ParcelleGeoData
  onSelect?: (parcelle: ParcelleGeoData) => void
}) {
  const geometry = useMemo(
    () => parseGeometry(parcelle.geometry),
    [parcelle.geometry]
  )

  // Construction du GeoJSON Feature
  const feature = useMemo<Feature | null>(() => {
    if (!geometry) return null
    return {
      type: "Feature",
      properties: {
        id: parcelle.id,
        nom: parcelle.nom,
      },
      geometry,
    }
  }, [geometry, parcelle.id, parcelle.nom])

  // Style du polygone
  const style = useMemo<PathOptions>(
    () => ({
      color: parcelle.couleur || DEFAULT_COULEUR,
      weight: 2,
      opacity: 0.8,
      fillColor: parcelle.couleur || DEFAULT_COULEUR,
      fillOpacity: 0.25,
    }),
    [parcelle.couleur]
  )

  // Gestion des evenements sur chaque feature
  const onEachFeature = useCallback(
    (_feature: Feature, layer: Layer) => {
      // Effet de survol : augmenter l'opacite du remplissage
      layer.on({
        mouseover: (e: LeafletMouseEvent) => {
          const target = e.target
          target.setStyle({
            fillOpacity: 0.45,
            weight: 3,
          })
        },
        mouseout: (e: LeafletMouseEvent) => {
          const target = e.target
          target.setStyle({
            fillOpacity: 0.25,
            weight: 2,
          })
        },
        click: () => {
          if (onSelect) {
            onSelect(parcelle)
          }
        },
      })
    },
    [onSelect, parcelle]
  )

  if (!feature) return null

  // Construction du texte du tooltip. `surface` est déjà en hectares
  // (schema : surface_ha) — l'ancienne division par 10000 affichait « 0.00 ha »
  // pour quasiment toutes les parcelles (audit 2026-07, #32).
  const tooltipContent = parcelle.nom + (
    parcelle.surface
      ? ` - ${parcelle.surface.toFixed(2)} ha`
      : ""
  )

  return (
    <GeoJSON
      key={parcelle.id}
      data={feature}
      style={style}
      onEachFeature={onEachFeature}
    >
      <Tooltip sticky>{tooltipContent}</Tooltip>
    </GeoJSON>
  )
}

export default function ParcelleLayer({
  parcelles,
  onSelect,
  editingId,
}: ParcelleLayerProps) {
  if (!parcelles || parcelles.length === 0) return null

  return (
    <>
      {parcelles
        .filter((p) => p.id !== editingId)
        .map((parcelle) => (
          <ParcelleFeature
            key={parcelle.id}
            parcelle={parcelle}
            onSelect={onSelect}
          />
        ))}
    </>
  )
}
