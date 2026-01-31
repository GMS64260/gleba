"use client"

/**
 * Dialog pour gérer un événement du calendrier
 * Permet de marquer comme fait, voir détails, modifier
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
import { Sprout, Leaf, Package, Droplets, ExternalLink, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CalendarEvent {
  id: number
  type: "semis" | "plantation" | "recolte" | "irrigation"
  especeId: string
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
    // Pour les récoltes, demander la quantité si on marque comme fait
    if (event.type === "recolte" && !event.fait) {
      const quantiteStr = prompt("Quantité récoltée (kg) :")
      if (!quantiteStr) return // Annulé

      const quantite = parseFloat(quantiteStr)
      if (isNaN(quantite) || quantite <= 0) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Quantité invalide",
        })
        return
      }

      setLoading(true)
      try {
        // Créer la récolte
        const responseRecolte = await fetch("/api/recoltes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cultureId: event.id,
            especeId: event.especeId,
            date: new Date().toISOString(),
            quantite,
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
          description: `${quantite} kg de ${event.especeId}`,
        })

        onUpdate()
        onOpenChange(false)
      } catch (error) {
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
          }),
        })
        if (!response.ok) throw new Error("Erreur")
      } else {
        // Marquer semis/plantation/récolte
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
    } catch (error) {
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
      <DialogContent className="sm:max-w-[425px]">
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
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              {event.couleur && (
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: event.couleur }}
                />
              )}
              <span className="font-medium">{event.especeId}</span>
            </div>
            <Link href={`/cultures/${event.type === 'irrigation' ? event.cultureId : event.id}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4 mr-1" />
                Ouvrir
              </Button>
            </Link>
          </div>

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

          {/* Actions */}
          <div className="flex gap-2">
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
              ) : (
                <>Marquer comme fait</>
              )}
            </Button>
            <Link href={`/cultures/${event.type === 'irrigation' ? event.cultureId : event.id}`} className="flex-1">
              <Button variant="outline" className="w-full">
                Modifier
              </Button>
            </Link>
          </div>

          {/* Info selon type */}
          <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
            {config.action}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
