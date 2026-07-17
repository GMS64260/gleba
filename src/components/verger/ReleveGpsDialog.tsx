"use client"

/**
 * Relevé GPS en série (feedback LVBB40430 2026-07-15) : enchaîne les arbres
 * sans coordonnées. On marche jusqu'à l'arbre, la position se met à jour en
 * continu (watchPosition), on enregistre, l'arbre suivant s'affiche.
 * Transforme la recopie manuelle de coordonnées en simple marche dans le verger.
 */

import * as React from "react"
import { Check, Loader2, MapPin, SkipForward } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { geolocationErrorMessage, roundCoord } from "@/lib/geolocation"

export interface ArbreAReleve {
  id: number
  nom: string
  espece: string | null
  variete: string | null
}

interface ReleveGpsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Arbres sans coordonnées, dans l'ordre de relevé. */
  arbres: ArbreAReleve[]
  /** Notifié après chaque enregistrement réussi (mise à jour de la liste parent). */
  onSaved: (arbreId: number, lat: number, lng: number) => void
}

interface LiveFix {
  lat: number
  lng: number
  accuracy: number
}

function accuracyTone(accuracy: number): string {
  if (accuracy <= 8) return "text-green-700 bg-green-50 border-green-200"
  if (accuracy <= 20) return "text-amber-700 bg-amber-50 border-amber-200"
  return "text-red-700 bg-red-50 border-red-200"
}

export function ReleveGpsDialog({ open, onOpenChange, arbres, onSaved }: ReleveGpsDialogProps) {
  const { toast } = useToast()
  // File figée à l'ouverture : la liste parent bouge après chaque save.
  const [queue, setQueue] = React.useState<ArbreAReleve[]>([])
  const [index, setIndex] = React.useState(0)
  const [fix, setFix] = React.useState<LiveFix | null>(null)
  const [geoError, setGeoError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [savedCount, setSavedCount] = React.useState(0)

  React.useEffect(() => {
    if (open) {
      setQueue(arbres)
      setIndex(0)
      setSavedCount(0)
    }
    // `arbres` volontairement hors deps : snapshot à l'ouverture uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Position en continu tant que la modale est ouverte : la précision
  // s'affine pendant qu'on marche, pas de démarrage GPS à froid par arbre.
  React.useEffect(() => {
    if (!open) return
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("La géolocalisation n'est pas supportée par votre navigateur.")
      return
    }
    setGeoError(null)
    setFix(null)
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGeoError(null)
        setFix({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (error) => setGeoError(geolocationErrorMessage(error)),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [open])

  const current = index < queue.length ? queue[index] : null
  const done = queue.length > 0 && index >= queue.length

  const handleSave = async () => {
    if (!current || !fix) return
    setSaving(true)
    const lat = roundCoord(fix.lat)
    const lng = roundCoord(fix.lng)
    try {
      // PUT partiel : la route ne touche que les champs présents dans le body.
      const res = await fetch(`/api/arbres/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gpsLat: lat, gpsLng: lng }),
      })
      if (!res.ok) throw new Error("save failed")
      onSaved(current.id, lat, lng)
      setSavedCount((c) => c + 1)
      setIndex((i) => i + 1)
    } catch {
      toast({
        variant: "destructive",
        title: "Position non enregistrée",
        description: `Échec de l'enregistrement pour ${current.nom}. Réessayez.`,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-lime-600" />
            Relevé GPS en série
          </DialogTitle>
          <DialogDescription>
            Placez-vous au pied de chaque arbre, attendez une bonne précision, puis
            enregistrez. Les positions déjà enregistrées sont conservées si vous fermez.
          </DialogDescription>
        </DialogHeader>

        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Tous vos arbres ont déjà des coordonnées GPS. 🎉
          </p>
        ) : done ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-green-700">
              <Check className="h-5 w-5" />
              <p className="font-medium">
                {savedCount} position{savedCount > 1 ? "s" : ""} enregistrée{savedCount > 1 ? "s" : ""}
              </p>
            </div>
            {savedCount < queue.length && (
              <p className="text-sm text-muted-foreground">
                {queue.length - savedCount} arbre{queue.length - savedCount > 1 ? "s" : ""} passé
                {queue.length - savedCount > 1 ? "s" : ""} (toujours sans coordonnées).
              </p>
            )}
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Terminer
            </Button>
          </div>
        ) : current ? (
          <div className="space-y-4">
            {/* Progression */}
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-xs text-muted-foreground">
                  Arbre {index + 1} / {queue.length}
                </p>
                {savedCount > 0 && (
                  <p className="text-xs text-green-700">
                    {savedCount} enregistré{savedCount > 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-lime-600 transition-all"
                  style={{ width: `${(index / queue.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Arbre courant */}
            <div className="rounded-lg border bg-lime-50/50 border-lime-200 px-3 py-2.5">
              <p className="font-semibold">{current.nom}</p>
              {(current.espece || current.variete) && (
                <p className="text-sm text-muted-foreground">
                  {[current.espece, current.variete].filter(Boolean).join(" — ")}
                </p>
              )}
            </div>

            {/* Position live */}
            {geoError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {geoError}
              </div>
            ) : fix ? (
              <div className={`rounded-md border px-3 py-2 text-sm ${accuracyTone(fix.accuracy)}`}>
                <p className="font-mono text-xs">
                  {roundCoord(fix.lat)}, {roundCoord(fix.lng)}
                </p>
                <p className="mt-0.5">
                  Précision : ± {Math.round(fix.accuracy)} m
                  {fix.accuracy > 20 && " — attendez quelques secondes à découvert pour affiner"}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Recherche du signal GPS…
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIndex((i) => i + 1)}
                disabled={saving}
              >
                <SkipForward className="h-4 w-4 mr-1.5" />
                Passer
              </Button>
              <Button
                type="button"
                className="flex-[2]"
                onClick={handleSave}
                disabled={!fix || saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4 mr-1.5" />
                )}
                Enregistrer et suivant
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
