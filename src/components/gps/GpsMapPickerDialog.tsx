"use client"

/**
 * Sélecteur de position GPS sur carte (feedback LVBB40430) : plutôt que de
 * taper des coordonnées à la main, on pointe l'arbre sur l'orthophoto IGN
 * ou on se géolocalise. Utilisé par la modale d'ajout d'arbre, la fiche
 * arbre, et réutilisable ailleurs.
 */

import * as React from "react"
import dynamic from "next/dynamic"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { roundCoord } from "@/lib/geolocation"
import type { GpsContextPoint } from "./GpsMapPickerMap"

const GpsMapPickerMap = dynamic(() => import("./GpsMapPickerMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted animate-pulse" />,
})

interface GpsMapPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Coordonnées actuelles (si déjà renseignées). */
  initialLat?: number | null
  initialLng?: number | null
  /** Points de repère affichés en bleu (ex: arbres déjà géolocalisés). */
  contextPoints?: GpsContextPoint[]
  onConfirm: (lat: number, lng: number) => void
  title?: string
}

const FRANCE_CENTER: [number, number] = [46.6, 2.3]
const FRANCE_ZOOM = 6

export function GpsMapPickerDialog({
  open,
  onOpenChange,
  initialLat,
  initialLng,
  contextPoints = [],
  onConfirm,
  title = "Choisir la position sur la carte",
}: GpsMapPickerDialogProps) {
  const [value, setValue] = React.useState<{ lat: number; lng: number } | null>(null)
  const [view, setView] = React.useState<{ center: [number, number]; zoom: number } | null>(null)

  // Vue initiale à l'ouverture : point existant > arbres géolocalisés >
  // centroïde des parcelles de l'utilisateur > France entière.
  React.useEffect(() => {
    if (!open) {
      setView(null)
      return
    }
    // Number.isFinite écarte un éventuel NaN issu d'une saisie manuelle vide.
    const lat0 = typeof initialLat === "number" && Number.isFinite(initialLat) ? initialLat : null
    const lng0 = typeof initialLng === "number" && Number.isFinite(initialLng) ? initialLng : null
    if (lat0 != null && lng0 != null) {
      setValue({ lat: lat0, lng: lng0 })
      setView({ center: [lat0, lng0], zoom: 19 })
      return
    }
    setValue(null)
    if (contextPoints.length > 0) {
      const lat = contextPoints.reduce((s, p) => s + p.lat, 0) / contextPoints.length
      const lng = contextPoints.reduce((s, p) => s + p.lng, 0) / contextPoints.length
      setView({ center: [lat, lng], zoom: 18 })
      return
    }
    let cancelled = false
    fetch("/api/carte")
      .then((r) => (r.ok ? r.json() : []))
      .then((parcelles) => {
        if (cancelled) return
        const pts = (Array.isArray(parcelles) ? parcelles : []).filter(
          (p) => p.centroidLat != null && p.centroidLng != null
        )
        if (pts.length > 0) {
          const lat = pts.reduce((s: number, p: { centroidLat: number }) => s + p.centroidLat, 0) / pts.length
          const lng = pts.reduce((s: number, p: { centroidLng: number }) => s + p.centroidLng, 0) / pts.length
          setView({ center: [lat, lng], zoom: 17 })
        } else {
          setView({ center: FRANCE_CENTER, zoom: FRANCE_ZOOM })
        }
      })
      .catch(() => {
        if (!cancelled) setView({ center: FRANCE_CENTER, zoom: FRANCE_ZOOM })
      })
    return () => {
      cancelled = true
    }
    // contextPoints volontairement hors deps : on fige la vue à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialLat, initialLng])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Touchez la carte pour placer le point (le marqueur se déplace aussi par
            glisser-déposer), ou utilisez « Ma position » en bas de la carte.
          </DialogDescription>
        </DialogHeader>
        <div className="h-[55dvh] min-h-[280px] w-full overflow-hidden rounded-md border">
          {view ? (
            <GpsMapPickerMap
              center={view.center}
              zoom={view.zoom}
              value={value}
              onChange={(lat, lng) => setValue({ lat, lng })}
              contextPoints={contextPoints}
            />
          ) : (
            <div className="h-full w-full bg-muted animate-pulse" />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground font-mono">
            {value ? `${roundCoord(value.lat)}, ${roundCoord(value.lng)}` : "Aucun point placé"}
          </p>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              disabled={!value}
              onClick={() => {
                if (!value) return
                onConfirm(roundCoord(value.lat), roundCoord(value.lng))
                onOpenChange(false)
              }}
            >
              Utiliser cette position
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
