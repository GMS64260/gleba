"use client"

/**
 * Composant principal de carte georeferencee
 * Utilise Leaflet avec plusieurs fonds de carte (OSM, IGN Satellite, Cadastre, Plan IGN)
 */

import { useCallback, type ReactNode } from "react"
import L from "leaflet"
import {
  MapContainer as LeafletMapContainer,
  TileLayer,
  LayersControl,
} from "react-leaflet"

import "leaflet/dist/leaflet.css"
import "leaflet-draw/dist/leaflet.draw.css"

// Fix des icones Leaflet par defaut (incompatibles avec les bundlers webpack/Next.js)
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
})

// Centre par defaut : France metropolitaine
const DEFAULT_CENTER: L.LatLngExpression = [46.6, 2.3]
const DEFAULT_ZOOM = 6

// URLs des fonds de carte
const TILE_URLS = {
  osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  satelliteIgn:
    "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg",
  cadastreIgn:
    "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=PCI vecteur&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png",
  planIgn:
    "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png",
} as const

// Attributions
const ATTRIBUTIONS = {
  osm: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  ign: '&copy; <a href="https://www.ign.fr/">IGN</a>',
} as const

interface MapContainerProps {
  center?: L.LatLngExpression
  zoom?: number
  onMapReady?: (map: L.Map) => void
  children?: ReactNode
}

export default function MapContainer({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  onMapReady,
  children,
}: MapContainerProps) {
  // Callback quand la carte est initialisee
  const handleMapRef = useCallback(
    (map: L.Map | null) => {
      if (map && onMapReady) {
        onMapReady(map)
      }
    },
    [onMapReady]
  )

  return (
    <div className="relative h-full w-full z-0">
      <LeafletMapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        ref={handleMapRef}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        {/* Selecteur de fonds de carte */}
        <LayersControl position="topright">
          {/* Fonds de carte (base layers) - un seul actif a la fois */}
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              url={TILE_URLS.osm}
              attribution={ATTRIBUTIONS.osm}
              maxZoom={19}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Satellite IGN">
            <TileLayer
              url={TILE_URLS.satelliteIgn}
              attribution={ATTRIBUTIONS.ign}
              maxZoom={19}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Plan IGN">
            <TileLayer
              url={TILE_URLS.planIgn}
              attribution={ATTRIBUTIONS.ign}
              maxZoom={19}
            />
          </LayersControl.BaseLayer>

          {/* Couches superposables (overlays) */}
          <LayersControl.Overlay name="Cadastre IGN">
            <TileLayer
              url={TILE_URLS.cadastreIgn}
              attribution={ATTRIBUTIONS.ign}
              maxZoom={19}
              opacity={0.7}
            />
          </LayersControl.Overlay>
        </LayersControl>

        {/* Contenu additionnel (marqueurs, polygones, controles...) */}
        {children}
      </LeafletMapContainer>
    </div>
  )
}
