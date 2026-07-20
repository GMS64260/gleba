"use client"

/**
 * Dialog pour gérer un événement du calendrier
 * Permet de marquer comme fait, voir details, modifier
 */

import * as React from "react"
import Link from "next/link"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sprout, Leaf, Package, Droplets, ExternalLink, Loader2, MapPin } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CalendarEvent {
  id: number
  type: "semis" | "plantation" | "recolte" | "irrigation"
  especeId: string
  especeNom?: string | null
  varieteId: string | null
  varieteNom?: string | null
  plancheName: string | null
  ilot: string | null
  date: string
  fait: boolean
  couleur: string | null
  cultureId?: number // Pour les irrigations, ID de la culture liée
}

interface EventDialogProps {
  event: CalendarEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
}

export function EventDialog({ event, open, onOpenChange, onUpdate }: EventDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [completionMode, setCompletionMode] = React.useState(false)
  const [quantite, setQuantite] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const eventId = event?.id
  const eventType = event?.type
  const eventFait = event?.fait

  React.useEffect(() => {
    setCompletionMode(Boolean(!eventFait && (eventType === "recolte" || eventType === "irrigation")))
    setQuantite("")
    setNotes("")
  }, [eventId, eventType, eventFait, open])

  if (!event) return null

  const typeConfig = {
    semis: {
      icon: Sprout,
      color: "text-orange-500",
      bg: "bg-orange-100",
      label: "Semis",
      field: "semisFait",
      action: "Marquer le semis comme effectué",
    },
    plantation: {
      icon: Leaf,
      color: "text-green-500",
      bg: "bg-green-100",
      label: "Plantation",
      field: "plantationFaite",
      action: "Marquer la plantation comme effectuée",
    },
    recolte: {
      icon: Package,
      color: "text-purple-500",
      bg: "bg-purple-100",
      label: "Récolte",
      field: "recolteFaite",
      action: "Marquer la récolte comme effectuée",
    },
    irrigation: {
      icon: Droplets,
      color: "text-cyan-500",
      bg: "bg-cyan-100",
      label: "Irrigation",
      field: "derniereIrrigation",
      action: "Noter l'arrosage d'aujourd'hui",
    },
  }

  const config = typeConfig[event.type]
  const Icon = config.icon

  const handleToggle = async () => {
    // Les informations complémentaires restent dans ce même overlay : aucune
    // boîte prompt/confirm native et aucun empilement de fenêtres.
    if (!event.fait && (event.type === "recolte" || event.type === "irrigation") && !completionMode) {
      setCompletionMode(true)
      return
    }

    if (event.type === "recolte" && !event.fait) {
      const parsedQuantite = Number.parseFloat(quantite.replace(",", "."))
      if (!Number.isFinite(parsedQuantite) || parsedQuantite <= 0) {
        toast({
          variant: "destructive",
          title: "Quantité à renseigner",
          description: "Indiquez une quantité récoltée supérieure à zéro.",
        })
        return
      }

      setLoading(true)
      try {
        // Créer la recolte
        const responseRecolte = await fetch("/api/recoltes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cultureId: event.id,
            especeId: event.especeId,
            date: new Date().toISOString(),
            quantite: parsedQuantite,
          }),
        })
        if (!responseRecolte.ok) throw new Error("Erreur création récolte")

        // Marquer la culture comme récoltée
        await fetch(`/api/cultures/${event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recolteFaite: true }),
        })

        toast({
          title: "Récolte enregistrée",
          description: `${parsedQuantite} kg de ${event.especeNom ?? event.especeId}`,
        })

        onUpdate()
        onOpenChange(false)
      } catch {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible d'enregistrer la récolte",
        })
      } finally {
        setLoading(false)
      }
      return
    }

    // Pour les autres types (semis, plantation, irrigation)
    setLoading(true)
    try {
      if (event.type === "irrigation") {
        // Marquer l'irrigation planifiée comme faite
        const response = await fetch(`/api/irrigations/${event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fait: !event.fait,
            dateEffective: !event.fait ? new Date().toISOString() : null,
            notes: !event.fait ? notes.trim() || null : null,
          }),
        })
        if (!response.ok) throw new Error("Erreur")
      } else {
        // Marquer semis/plantation/recolte
        const response = await fetch(`/api/cultures/${event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [config.field]: !event.fait,
          }),
        })
        if (!response.ok) throw new Error("Erreur")
      }

      toast({
        title: "Mis à jour",
        description: event.fait
          ? `${config.label} marqué comme non effectué`
          : `${config.label} marqué comme effectué`,
      })

      onUpdate()
      onOpenChange(false)
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <DialogTitle>{config.label}</DialogTitle>
              <DialogDescription>
                {format(new Date(event.date), "EEEE d MMMM yyyy", { locale: fr })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Culture */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              {event.couleur && (
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: event.couleur }}
                />
              )}
              <div>
                <span className="font-medium">{event.especeNom ?? event.especeId}</span>
                {event.varieteId && (
                  <span className="text-sm text-muted-foreground ml-1">({event.varieteNom ?? event.varieteId})</span>
                )}
              </div>
            </div>
            <Link href={`/maraichage/cultures/${event.type === 'irrigation' ? event.cultureId : event.id}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4 mr-1" />
                Ouvrir
              </Button>
            </Link>
          </div>

          {/* Destination */}
          {event.plancheName && (
            <div className="flex items-center gap-2 p-3 bg-teal-50 rounded-lg">
              <MapPin className="h-4 w-4 text-teal-600 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-teal-800">Planche : {event.plancheName}</span>
                {event.ilot && (
                  <span className="text-teal-600 ml-1">(Ilot {event.ilot})</span>
                )}
              </div>
            </div>
          )}

          {/* Statut */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox checked={event.fait} disabled />
              <span className="text-sm">
                {event.fait ? "Effectué" : "À faire"}
              </span>
            </div>
            {event.fait && (
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                ✓ Fait
              </Badge>
            )}
          </div>

          {completionMode && event.type === "recolte" && (
            <div className="space-y-3 rounded-xl border border-purple-200 bg-purple-50/60 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="event-recolte-quantite">Quantité récoltée</Label>
                <div className="relative">
                  <Input
                    id="event-recolte-quantite"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    autoFocus
                    value={quantite}
                    onChange={(e) => setQuantite(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleToggle()
                    }}
                    placeholder="0,00"
                    className="h-11 pr-12 text-base"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground">kg</span>
                </div>
              </div>
            </div>
          )}

          {completionMode && event.type === "irrigation" && (
            <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="event-irrigation-notes">Observation</Label>
                <Textarea
                  id="event-irrigation-notes"
                  autoFocus
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Sol sec, pluie récente, quantité ajustée…"
                  className="min-h-20 resize-none bg-white"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              onClick={handleToggle}
              disabled={loading}
              className="flex-1"
              variant={event.fait ? "outline" : "default"}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Mise à jour...
                </>
              ) : event.fait ? (
                <>Annuler</>
              ) : completionMode && event.type === "recolte" ? (
                <>Enregistrer la récolte</>
              ) : completionMode && event.type === "irrigation" ? (
                <>Confirmer l’arrosage</>
              ) : (
                <>Marquer comme fait</>
              )}
            </Button>
            <Link href={`/maraichage/cultures/${event.type === 'irrigation' ? event.cultureId : event.id}`} className="flex-1">
              <Button variant="outline" className="w-full">
                Modifier
              </Button>
            </Link>
          </div>

          {/* Info selon type */}
          {event.fait || (event.type !== "recolte" && event.type !== "irrigation") ? (
            <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
              {config.action}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
