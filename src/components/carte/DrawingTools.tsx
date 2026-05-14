"use client"

import { useEffect, useRef, useCallback } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'

interface DrawingToolsProps {
  isDrawing: boolean
  onDrawComplete: (geojson: string) => void
  onCancel: () => void
}

/**
 * Composant de dessin de parcelles sur la carte Leaflet.
 * Utilise l'API Leaflet Draw en mode programmatique (sans le Control.Draw par defaut).
 * Active/desactive le handler polygon en fonction de la prop isDrawing.
 */
export default function DrawingTools({ isDrawing, onDrawComplete, onCancel }: DrawingToolsProps) {
  const map = useMap()
  const handlerRef = useRef<L.Draw.Polygon | null>(null)
  const listenerRef = useRef<((e: any) => void) | null>(null)

  // Callback stable pour gerer la fin du dessin
  const handleCreated = useCallback((e: any) => {
    const layer = e.layer as L.Polygon
    const geojson = (layer as any).toGeoJSON().geometry
    onDrawComplete(JSON.stringify(geojson))
  }, [onDrawComplete])

  useEffect(() => {
    if (!map) return

    if (isDrawing) {
      // Creer et activer le handler de dessin polygon
      const handler = new L.Draw.Polygon(map, {
        shapeOptions: {
          color: '#16a34a',
          weight: 3,
          fillOpacity: 0.15,
        },
        showArea: true,
        metric: true,
      })

      handlerRef.current = handler

      // Ecouter l'evenement de creation
      const onCreated = (e: any) => {
        handleCreated(e)
      }
      listenerRef.current = onCreated
      map.on(L.Draw.Event.CREATED, onCreated)

      handler.enable()
    } else {
      // Desactiver le handler si actif
      if (handlerRef.current) {
        handlerRef.current.disable()
        handlerRef.current = null
      }

      // Retirer le listener
      if (listenerRef.current) {
        map.off(L.Draw.Event.CREATED, listenerRef.current)
        listenerRef.current = null
      }
    }

    // Cleanup au demontage ou au changement
    return () => {
      if (handlerRef.current) {
        handlerRef.current.disable()
        handlerRef.current = null
      }
      if (listenerRef.current) {
        map.off(L.Draw.Event.CREATED, listenerRef.current)
        listenerRef.current = null
      }
    }
  }, [map, isDrawing, handleCreated])

  // Ce composant ne rend rien visuellement, il agit sur la carte via les refs
  return null
}
