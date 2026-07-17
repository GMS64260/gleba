"use client"

/**
 * Carte Leaflet du sélecteur de position GPS. Chargée dynamiquement
 * (jamais en SSR) via GpsMapPickerDialog.
 *
 * Fond satellite IGN par défaut : pointer l'arbre sur l'orthophoto est
 * souvent plus précis que le GPS du téléphone sous couvert végétal, et
 * permet la saisie au bureau pour un verger déjà planté.
 */

import * as React from "react"
import L from "leaflet"
import {
  MapContainer,
  TileLayer,
  LayersControl,
  Marker,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { LocateFixed, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getCurrentGpsFix } from "@/lib/geolocation"
import { TILE_URLS, ATTRIBUTIONS } from "@/components/carte/MapContainer"

export interface GpsContextPoint {
  lat: number
  lng: number
  label: string
}

interface GpsMapPickerMapProps {
  center: [number, number]
  zoom: number
  value: { lat: number; lng: number } | null
  onChange: (lat: number, lng: number) => void
  /** Points de repère (ex: arbres déjà géolocalisés). */
  contextPoints?: GpsContextPoint[]
}

// Pastille centrée plutôt qu'une épingle : l'ancrage est exact au pixel
// près, et on évite les icônes PNG par défaut de Leaflet (CDN externe).
const markerIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:9999px;background:#65a30d;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

// Les tuiles ortho IGN s'arrêtent au zoom 19 ; on autorise 2 niveaux
// d'agrandissement (tuiles upscalées) pour viser un arbre à 2-3 m près
// confortablement au doigt.
const MAX_ZOOM = 21
const MAX_NATIVE_ZOOM = 19

function ClickToPlace({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onChange(e.latlng.lat, e.latlng.lng),
  })
  return null
}

/**
 * La modale s'anime (zoom/fade ~200 ms) pendant que Leaflet mesure son
 * conteneur : sans invalidateSize différé, les tuiles restent grises.
 */
function InvalidateOnMount() {
  const map = useMap()
  React.useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 250)
    const t2 = setTimeout(() => map.invalidateSize(), 700)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [map])
  return null
}

/** Bouton « me localiser » : centre la carte ET place le point. */
function GeolocateOverlay({ onFix }: { onFix: (lat: number, lng: number) => void }) {
  const map = useMap()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const fix = await getCurrentGpsFix()
      map.setView([fix.lat, fix.lng], Math.max(map.getZoom(), MAX_NATIVE_ZOOM))
      onFix(fix.lat, fix.lng)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Géolocalisation impossible",
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="absolute bottom-3 right-3 z-[1000]">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3 shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm text-slate-700"
        title="Placer le point sur ma position"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LocateFixed className="h-4 w-4" />
        )}
        Ma position
      </button>
    </div>
  )
}

export default function GpsMapPickerMap({
  center,
  zoom,
  value,
  onChange,
  contextPoints = [],
}: GpsMapPickerMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      maxZoom={MAX_ZOOM}
      className="h-full w-full"
      scrollWheelZoom
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Satellite IGN">
          <TileLayer
            url={TILE_URLS.satelliteIgn}
            attribution={ATTRIBUTIONS.ign}
            maxZoom={MAX_ZOOM}
            maxNativeZoom={MAX_NATIVE_ZOOM}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="OpenStreetMap">
          <TileLayer
            url={TILE_URLS.osm}
            attribution={ATTRIBUTIONS.osm}
            maxZoom={MAX_ZOOM}
            maxNativeZoom={MAX_NATIVE_ZOOM}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Plan IGN">
          <TileLayer
            url={TILE_URLS.planIgn}
            attribution={ATTRIBUTIONS.ign}
            maxZoom={MAX_ZOOM}
            maxNativeZoom={MAX_NATIVE_ZOOM}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <InvalidateOnMount />
      <ClickToPlace onChange={onChange} />

      {contextPoints.map((p, i) => (
        <CircleMarker
          key={`${p.lat}-${p.lng}-${i}`}
          center={[p.lat, p.lng]}
          radius={5}
          pathOptions={{ color: "#fff", weight: 1.5, fillColor: "#0ea5e9", fillOpacity: 0.9 }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {p.label}
          </Tooltip>
        </CircleMarker>
      ))}

      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={markerIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng()
              onChange(ll.lat, ll.lng)
            },
          }}
        />
      )}

      <GeolocateOverlay onFix={onChange} />
    </MapContainer>
  )
}
