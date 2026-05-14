"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Move } from "lucide-react"
import { calculateSurfaceHa } from "@/lib/geo-utils"

const MapContainer = dynamic(
  () => import("@/components/carte/MapContainer"),
  { ssr: false, loading: () => <div className="h-64 bg-muted animate-pulse rounded" /> }
)
const DrawingTools = dynamic(() => import("@/components/carte/DrawingTools"), { ssr: false })
const EditingTools = dynamic(() => import("@/components/carte/EditingTools"), { ssr: false })

interface ParcelleFormMapProps {
  geometry: string | null
  onGeometryChange: (geojson: string | null) => void
}

export function ParcelleFormMap({ geometry, onGeometryChange }: ParcelleFormMapProps) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editMode, setEditMode] = useState<"vertices" | "move">("vertices")
  const [surface, setSurface] = useState<number | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polygonLayerRef = useRef<any>(null)

  // Calculer la surface quand la geometrie change
  useEffect(() => {
    if (geometry) {
      setSurface(calculateSurfaceHa(geometry))
    } else {
      setSurface(null)
    }
  }, [geometry])

  // Afficher le polygone existant sur la carte
  useEffect(() => {
    const map = mapRef.current
    if (!map || isDrawing || isEditing) return

    let cancelled = false

    // Nettoyer l'ancien polygone
    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current)
      polygonLayerRef.current = null
    }

    if (geometry) {
      import("leaflet").then((L) => {
        if (cancelled) return
        try {
          const geoObj = JSON.parse(geometry)
          const layer = L.geoJSON(
            { type: "Feature", properties: {}, geometry: geoObj } as any,
            {
              style: {
                color: "#7c3aed",
                weight: 3,
                fillColor: "#7c3aed",
                fillOpacity: 0.15,
              },
            }
          )
          layer.addTo(map)
          polygonLayerRef.current = layer

          const bounds = layer.getBounds()
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 })
          }
        } catch {
          // Geometrie invalide
        }
      })
    }

    return () => { cancelled = true }
  }, [geometry, isDrawing, isEditing])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMapReady = useCallback((map: any) => {
    mapRef.current = map
  }, [])

  const handleDrawComplete = useCallback((geojson: string) => {
    setIsDrawing(false)
    onGeometryChange(geojson)
  }, [onGeometryChange])

  const handleEditComplete = useCallback((geojson: string) => {
    setIsEditing(false)
    onGeometryChange(geojson)
  }, [onGeometryChange])

  const startDraw = () => {
    if (polygonLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(polygonLayerRef.current)
      polygonLayerRef.current = null
    }
    setIsEditing(false)
    setIsDrawing(true)
  }

  const startEdit = (mode: "vertices" | "move") => {
    setIsDrawing(false)
    setEditMode(mode)
    setIsEditing(true)
  }

  const confirmEdit = () => {
    if (mapRef.current) {
      mapRef.current.fire("editing:confirm")
    }
  }

  const clearGeometry = () => {
    setIsDrawing(false)
    setIsEditing(false)
    onGeometryChange(null)
  }

  const surfaceDisplay = surface
    ? surface >= 1
      ? `${surface.toFixed(2)} ha`
      : `${Math.round(surface * 10000)} m\u00B2`
    : null

  return (
    <div className="space-y-2">
      <div className="h-64 rounded-lg overflow-hidden border">
        <MapContainer onMapReady={handleMapReady}>
          {isDrawing && (
            <DrawingTools
              isDrawing={isDrawing}
              onDrawComplete={handleDrawComplete}
              onCancel={() => setIsDrawing(false)}
            />
          )}
          {isEditing && geometry && (
            <EditingTools
              isEditing={isEditing}
              mode={editMode}
              geometry={geometry}
              onEditComplete={handleEditComplete}
              onCancel={() => setIsEditing(false)}
            />
          )}
        </MapContainer>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {!isDrawing && !isEditing && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={startDraw}>
                {geometry ? "Redessiner" : "Dessiner le contour"}
              </Button>
              {geometry && (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => startEdit("vertices")}>
                    <Pencil className="h-3 w-3 mr-1" />
                    Sommets
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => startEdit("move")}>
                    <Move className="h-3 w-3 mr-1" />
                    Deplacer
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearGeometry}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </>
          )}
          {isDrawing && (
            <span className="text-sm text-emerald-600 font-medium">
              Cliquez sur la carte pour dessiner le contour...
            </span>
          )}
          {isEditing && (
            <div className="flex items-center gap-1">
              <span className="text-sm text-blue-600 font-medium">
                Mode {editMode === "vertices" ? "sommets" : "deplacement"}
              </span>
              <Button type="button" size="sm" onClick={confirmEdit}>
                Valider
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Annuler
              </Button>
            </div>
          )}
        </div>

        {surfaceDisplay && (
          <span className="text-sm font-medium text-purple-700">
            Surface : {surfaceDisplay}
          </span>
        )}
      </div>
    </div>
  )
}
