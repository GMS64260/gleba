"use client"

/**
 * Détail d'un soin + action EXPLICITE « Injection faite maintenant ».
 *
 * QA #5 / #8 (2026-07-24) : sur le Calendrier et le Dashboard, toucher une carte
 * de soin la marquait silencieusement « fait » (validation accidentelle d'une
 * injection non administrée → registre sanitaire faux). Désormais un toucher
 * OUVRE ce détail (dose, voie, produit, rappel) et l'enregistrement passe par un
 * bouton explicite. Composant partagé par CalendrierTab et DashboardTab.
 */

import * as React from "react"
import { Stethoscope, Syringe, CalendarClock, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface SoinDetailItem {
  id: number
  injectionId?: string | null
  numeroInjection?: number | null
  type: string
  date: string
  datePrevue?: string | null
  produit?: string | null
  dose?: string | null
  voie?: string | null
  description?: string | null
  cout?: number | null
  fait: boolean
  animal?: { id: number; nom: string | null; identifiant?: string | null } | null
  lot?: { id: number; nom: string | null } | null
}

const VOIE_LABELS: Record<string, string> = {
  IM: "Intramusculaire (IM)",
  SC: "Sous-cutanée (SC)",
  IV: "Intraveineuse (IV)",
  PO: "Voie orale (PO)",
  Local: "Locale",
  IN: "Intranasale (IN)",
  Vaginal: "Vaginale",
  "Intra-mamm.": "Intra-mammaire",
  "Pour-on": "Pour-on",
}

export function SoinDetailDialog({
  soin,
  onClose,
  onMarquerFait,
  onRouvrir,
  typeLabels,
}: {
  soin: SoinDetailItem | null
  onClose: () => void
  onMarquerFait: (soin: SoinDetailItem) => void | Promise<void>
  onRouvrir?: (soin: SoinDetailItem) => void | Promise<void>
  typeLabels?: Record<string, string>
}) {
  const [submitting, setSubmitting] = React.useState(false)

  if (!soin) return null

  const cible = soin.animal
    ? soin.animal.identifiant || soin.animal.nom || `#${soin.animal.id}`
    : soin.lot
      ? soin.lot.nom || `Lot #${soin.lot.id}`
      : "—"
  const typeLabel = (typeLabels && typeLabels[soin.type]) || soin.type
  const rappel = soin.datePrevue ? new Date(soin.datePrevue) : null

  const handleFait = async () => {
    setSubmitting(true)
    try {
      await onMarquerFait(soin)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRouvrir = async () => {
    if (!onRouvrir) return
    setSubmitting(true)
    try {
      await onRouvrir(soin)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={soin != null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-blue-600" />
            {typeLabel}
          </DialogTitle>
          <DialogDescription>{cible}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          {soin.numeroInjection != null && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Administration</span>
              <span className="font-medium">Injection n°{soin.numeroInjection}</span>
            </div>
          )}
          {soin.produit && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Produit</span>
              <span className="font-medium text-right">{soin.produit}</span>
            </div>
          )}
          {soin.dose && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Dose</span>
              <span className="font-medium text-right">{soin.dose}</span>
            </div>
          )}
          {soin.voie && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Voie</span>
              <span className="font-medium text-right">{VOIE_LABELS[soin.voie] || soin.voie}</span>
            </div>
          )}
          {rappel && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> Rappel planifié
              </span>
              <span className="font-medium text-right">{rappel.toLocaleDateString("fr-FR")}</span>
            </div>
          )}
          {soin.description && (
            <p className="text-muted-foreground border-t pt-2">{soin.description}</p>
          )}
          {soin.fait && (
            <p className="flex items-center gap-1 text-green-700 border-t pt-2">
              <Check className="h-4 w-4" /> Déjà enregistré comme fait.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Fermer
          </Button>
          {soin.fait
            ? onRouvrir && (
                <Button variant="outline" onClick={handleRouvrir} disabled={submitting}>
                  {submitting ? "…" : "Rouvrir le soin"}
                </Button>
              )
            : (
                <Button onClick={handleFait} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                  <Syringe className="h-4 w-4 mr-1.5" />
                  {submitting ? "Enregistrement…" : "Injection faite maintenant"}
                </Button>
              )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
