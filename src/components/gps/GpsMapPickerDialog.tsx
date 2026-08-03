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
import { latitudeValide, longitudeValide, roundCoord } from "@/lib/geolocation"
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

/**
 * Médiane plutôt que moyenne (2026-08-03). Le centrage se calculait sur la
 * moyenne arithmétique des arbres déjà géolocalisés : deux lignes portant une
 * longitude héritée hors bornes (-563888 au lieu de -0.563888) tiraient la
 * moyenne à -86 752, et la carte s'ouvrait à des centaines de kilomètres du
 * verger. La médiane rend le centrage insensible à ces valeurs isolées.
 */
function mediane(values: number[]): number {
  const tries = [...values].sort((a, b) => a - b)
  const milieu = Math.floor(tries.length / 2)
  return tries.length % 2 === 1
    ? tries[milieu]
    : (tries[milieu - 1] + tries[milieu]) / 2
}

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
    // Les bornes écartent un NaN de saisie vide comme une valeur héritée hors
    // limites : on retombe alors sur les repères puis les parcelles, plutôt que
    // d'ouvrir la carte sur une position impossible.
    const lat0 =
      typeof initialLat === "number" && latitudeValide(initialLat) ? initialLat : null
    const lng0 =
      typeof initialLng === "number" && longitudeValide(initialLng) ? initialLng : null
    if (lat0 != null && lng0 != null) {
      setValue({ lat: lat0, lng: lng0 })
      setView({ center: [lat0, lng0], zoom: 19 })
      return
    }
    setValue(null)
    const reperes = contextPoints.filter(
      (p) => latitudeValide(p.lat) && longitudeValide(p.lng)
    )
    if (reperes.length > 0) {
      setView({
        center: [mediane(reperes.map((p) => p.lat)), mediane(reperes.map((p) => p.lng))],
        zoom: 18,
      })
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
      {/* Colonne flex à hauteur bornée (quasi plein écran sur mobile) : la
          carte prend l'espace restant (flex-1) et les boutons restent
          toujours visibles. Pas de scroll de modale — impossible de toute
          façon, le doigt sur la carte panne la carte, pas la page. */}
      <DialogContent className="flex flex-col overflow-hidden gap-3 p-3 sm:p-6 h-[calc(100dvh-1rem)] sm:h-[min(85dvh,46rem)] sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="pr-8">{title}</DialogTitle>
          <DialogDescription>
            Touchez la carte pour placer le point, ou utilisez « Ma position ».
            Glissez le marqueur pour ajuster.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 w-full overflow-hidden rounded-md border">
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground font-mono">
            {value ? `${roundCoord(value.lat)}, ${roundCoord(value.lng)}` : "Aucun point placé"}
          </p>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
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
