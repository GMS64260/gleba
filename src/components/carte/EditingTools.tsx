"use client"

/**
 * Outils d'édition de parcelle existante sur la carte.
 * Utilise Leaflet.Draw en mode programmatique pour éditer les sommets
 * et permettre le déplacement (drag) du polygone.
 */

import { useEffect, useRef, useCallback } from "react"
import { useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet-draw"

interface EditingToolsProps {
  isEditing: boolean
  mode: "vertices" | "move"
  geometry: string | null
  couleur?: string | null
  onEditComplete: (geojson: string) => void
  onCancel: () => void
}

export default function EditingTools({
  isEditing,
  mode,
  geometry,
  couleur,
  onEditComplete,
  onCancel,
}: EditingToolsProps) {
  const map = useMap()
  const featureGroupRef = useRef<L.FeatureGroup | null>(null)
  const polygonRef = useRef<L.Polygon | null>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<L.LatLng | null>(null)

  const extractGeometry = useCallback(() => {
    const polygon = polygonRef.current
    if (!polygon) return null
    const geojson = (polygon as any).toGeoJSON()
    return JSON.stringify(geojson.geometry)
  }, [])

  // Event custom pour confirmer l'édition depuis le parent
  useEffect(() => {
    if (!map || !isEditing) return

    const handler = () => {
      const newGeometry = extractGeometry()
      if (newGeometry) {
        onEditComplete(newGeometry)
      }
    }

    map.on("editing:confirm" as any, handler)
    return () => {
      map.off("editing:confirm" as any, handler)
    }
  }, [map, isEditing, extractGeometry, onEditComplete])

  // Setup et teardown du mode édition
  useEffect(() => {
    if (!map || !isEditing || !geometry) return

    let geoObj: any
    try {
      geoObj = JSON.parse(geometry)
    } catch {
      console.error("EditingTools: géométrie invalide")
      onCancel()
      return
    }

    const fg = new L.FeatureGroup()
    map.addLayer(fg)
    featureGroupRef.current = fg

    const color = couleur || "#16a34a"

    const geoLayer = L.geoJSON(
      { type: "Feature", properties: {}, geometry: geoObj } as any,
      {
        style: {
          color: "#2563eb",
          weight: 3,
          fillColor: color,
          fillOpacity: 0.3,
          dashArray: mode === "move" ? "8 4" : undefined,
        },
      }
    )

    const layers = geoLayer.getLayers()
    if (layers.length === 0) {
      onCancel()
      return
    }

    const polygon = layers[0] as L.Polygon
    fg.addLayer(polygon)
    polygonRef.current = polygon

    if (mode === "vertices") {
      if ((polygon as any).editing) {
        ;(polygon as any).editing.enable()
      }
    } else if (mode === "move") {
      const el = (polygon as any)._path as HTMLElement | undefined
      if (el) el.style.cursor = "grab"

      const onMouseDown = (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e as any)
        isDraggingRef.current = true
        dragStartRef.current = e.latlng
        map.dragging.disable()
        const pathEl = (polygon as any)._path as HTMLElement | undefined
        if (pathEl) pathEl.style.cursor = "grabbing"
        map.on("mousemove", onMouseMove)
        map.on("mouseup", onMouseUp)
      }

      const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!isDraggingRef.current || !dragStartRef.current) return
        const dlat = e.latlng.lat - dragStartRef.current.lat
        const dlng = e.latlng.lng - dragStartRef.current.lng
        const latlngs = polygon.getLatLngs() as L.LatLng[][] | L.LatLng[][][]
        polygon.setLatLngs(translateLatLngs(latlngs, dlat, dlng))
        dragStartRef.current = e.latlng
      }

      const onMouseUp = () => {
        isDraggingRef.current = false
        dragStartRef.current = null
        map.dragging.enable()
        const pathEl = (polygon as any)._path as HTMLElement | undefined
        if (pathEl) pathEl.style.cursor = "grab"
        map.off("mousemove", onMouseMove)
        map.off("mouseup", onMouseUp)
      }

      polygon.on("mousedown", onMouseDown)
    }

    const bounds = polygon.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 })
    }

    return () => {
      if (mode === "vertices" && (polygon as any).editing) {
        ;(polygon as any).editing.disable()
      }
      isDraggingRef.current = false
      map.dragging.enable()
      map.removeLayer(fg)
      featureGroupRef.current = null
      polygonRef.current = null
    }
  }, [map, isEditing, geometry, mode, couleur, onCancel])

  return null
}

function translateLatLngs(
  latlngs: L.LatLng[] | L.LatLng[][] | L.LatLng[][][],
  dlat: number,
  dlng: number
): any {
  if (Array.isArray(latlngs[0]) && Array.isArray((latlngs[0] as any)[0])) {
    return (latlngs as L.LatLng[][][]).map((ring) =>
      ring.map((segment) =>
        segment.map((ll) => L.latLng(ll.lat + dlat, ll.lng + dlng))
      )
    )
  } else if (Array.isArray(latlngs[0])) {
    return (latlngs as L.LatLng[][]).map((ring) =>
      ring.map((ll) => L.latLng(ll.lat + dlat, ll.lng + dlng))
    )
  } else {
    return (latlngs as L.LatLng[]).map((ll) =>
      L.latLng(ll.lat + dlat, ll.lng + dlng)
    )
  }
}
