"use client"

/**
 * QA Julien 2026-05-15 — Bug #6 : modale de confirmation générique,
 * légère et async-aware. Utilisée quand on veut une question simple
 * "OK / Annuler" sans le boilerplate du <DeleteConfirmDialog> (qui
 * liste les dépendances cascade).
 *
 * Variants :
 *   - "destructive" : bouton rouge, icône triangle (suppression / action perdante)
 *   - "warning"     : bouton ambre, icône triangle (action à risque réversible)
 *   - "default"     : bouton primaire neutre
 *
 * L'appel `onConfirm` peut être async — le bouton désactive et affiche
 * un spinner pendant la résolution. Le dialogue ne peut pas être fermé
 * pendant le chargement (évite double-clic).
 *
 * Le composant est aussi conçu pour servir au Dev 1 (Bug #2 override
 * dépassement seuil aliment — variant="warning").
 */

import * as React from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export type ConfirmVariant = "destructive" | "warning" | "default"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  /** Masque le bouton Annuler (mode alerte à un seul bouton). */
  hideCancel?: boolean
  /** Action exécutée à la confirmation. Le dialog se ferme à la résolution. */
  onConfirm: () => Promise<void> | void
}

const ICON_COLORS: Record<ConfirmVariant, string> = {
  destructive: "bg-red-100 text-red-600",
  warning: "bg-amber-100 text-amber-600",
  default: "bg-blue-100 text-blue-600",
}

const BUTTON_CLASSES: Record<ConfirmVariant, string> = {
  destructive: "bg-red-600 hover:bg-red-700 text-white",
  warning: "bg-amber-600 hover:bg-amber-700 text-white",
  default: "",
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "destructive",
  hideCancel = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [loading, setLoading] = React.useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${ICON_COLORS[variant]}`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-1">{description}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-2">
          {!hideCancel && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={BUTTON_CLASSES[variant]}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
