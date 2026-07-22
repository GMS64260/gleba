"use client"

/**
 * Couche d'affichage des parcelles sur la carte
 * Rend chaque parcelle en tant que polygone GeoJSON avec interaction
 */

import { useMemo, useCallback } from "react"
import { GeoJSON, Tooltip, Marker } from "react-leaflet"
import L, { type Layer, type PathOptions, type LeafletMouseEvent } from "leaflet"
import type { Feature, Geometry } from "geojson"

// Couleur par defaut pour les parcelles sans couleur definie
const DEFAULT_COULEUR = "#4ade80" // vert Tailwind green-400

/** Bétail présent sur une parcelle (renvoyé par /api/carte). */
export interface BetailParcelle {
  totalTetes: number
  animauxIndividuels: number
  lots: Array<{ id: number; nom: string | null; espece: string; quantiteActuelle: number }>
  parEspece: Array<{ espece: string; count: number }>
}

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
  centroidLat?: number | null
  centroidLng?: number | null
  betail?: BetailParcelle | null
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

  // Bétail présent : résumé pour le survol + pastille d'effectif au centroïde.
  const betail = parcelle.betail
  const hasBetail = !!betail && betail.totalTetes > 0
  const betailResume = hasBetail
    ? betail!.parEspece.map((e) => `${e.count} ${e.espece}`).join(", ")
    : ""

  // Pastille (divIcon) affichée en permanence sur les parcelles avec bétail,
  // pour « voir son bétail » d'un coup d'œil sans survoler (cartographie 2026-07-21).
  const betailIcon = useMemo(() => {
    if (!hasBetail) return null
    return L.divIcon({
      className: "",
      html: `<div style="background:#d97706;color:#fff;border:2px solid #fff;border-radius:9999px;padding:1px 8px;font-size:12px;font-weight:700;line-height:1.4;box-shadow:0 1px 3px rgba(0,0,0,.4);white-space:nowrap;">${betail!.totalTetes} têtes</div>`,
      iconAnchor: [0, 0],
    })
  }, [hasBetail, betail])

  if (!feature) return null

  // Construction du texte du tooltip. `surface` est déjà en hectares
  // (schema : surface_ha) — l'ancienne division par 10000 affichait « 0.00 ha »
  // pour quasiment toutes les parcelles (audit 2026-07, #32).
  const tooltipContent =
    parcelle.nom +
    (parcelle.surface ? ` - ${parcelle.surface.toFixed(2)} ha` : "") +
    (hasBetail ? ` · ${betail!.totalTetes} têtes (${betailResume})` : "")

  const hasCentroid =
    typeof parcelle.centroidLat === "number" && typeof parcelle.centroidLng === "number"

  return (
    <>
      <GeoJSON
        key={parcelle.id}
        data={feature}
        style={style}
        onEachFeature={onEachFeature}
      >
        <Tooltip sticky>{tooltipContent}</Tooltip>
      </GeoJSON>
      {hasBetail && hasCentroid && betailIcon && (
        <Marker
          position={[parcelle.centroidLat!, parcelle.centroidLng!]}
          icon={betailIcon}
          eventHandlers={{ click: () => onSelect?.(parcelle) }}
        >
          <Tooltip direction="top">{`${parcelle.nom} · ${betailResume}`}</Tooltip>
        </Marker>
      )}
    </>
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
