"use client"

/**
 * Bouton de geolocalisation pour la carte
 * Centre la carte sur la position GPS de l'utilisateur
 */

import { useState, useCallback } from "react"
import { useMap } from "react-leaflet"
import L from "leaflet"
import { Crosshair, Loader2 } from "lucide-react"

const GEOLOC_ZOOM = 16

export default function GeolocateControl() {
  const map = useMap()
  const [loading, setLoading] = useState(false)
  const [marker, setMarker] = useState<L.Marker | null>(null)

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      alert("La geolocalisation n'est pas supportee par votre navigateur.")
      return
    }

    setLoading(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const latlng: L.LatLngExpression = [latitude, longitude]

        // Centrer la carte sur la position
        map.setView(latlng, GEOLOC_ZOOM)

        // Supprimer l'ancien marqueur s'il existe
        if (marker) {
          marker.remove()
        }

        // Ajouter un marqueur temporaire a la position
        const newMarker = L.marker(latlng)
          .addTo(map)
          .bindPopup("Vous etes ici")
          .openPopup()

        // Supprimer le marqueur apres 10 secondes
        setTimeout(() => {
          newMarker.remove()
          setMarker(null)
        }, 10000)

        setMarker(newMarker)
        setLoading(false)
      },
      (error) => {
        setLoading(false)
        let message = "Impossible de determiner votre position."
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Acces a la geolocalisation refuse."
            break
          case error.POSITION_UNAVAILABLE:
            message = "Position indisponible."
            break
          case error.TIMEOUT:
            message = "Délai de geolocalisation depasse."
            break
        }
        alert(message)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    )
  }, [map, marker])

  return (
    <div className="absolute bottom-6 right-3 z-[1000]">
      <button
        type="button"
        onClick={handleGeolocate}
        disabled={loading}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Centrer sur ma position"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 text-slate-600 animate-spin" />
        ) : (
          <Crosshair className="h-5 w-5 text-slate-600" />
        )}
      </button>
    </div>
  )
}
