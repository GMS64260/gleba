"use client"

/**
 * Hôte unique des dialogues globaux (confirmDialog/alertDialog).
 * Monté une fois dans le layout racine. Affiche une modale React
 * (ConfirmDialog) pour chaque requête — jamais de fenêtre système.
 */

import * as React from "react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { registerDialogHost, type GlobalDialogRequest } from "@/lib/global-dialog"

export function GlobalDialogHost() {
  const [current, setCurrent] = React.useState<GlobalDialogRequest | null>(null)
  const queueRef = React.useRef<GlobalDialogRequest[]>([])

  const showNext = React.useCallback(() => {
    setCurrent((prev) => {
      if (prev) return prev
      return queueRef.current.shift() ?? null
    })
  }, [])

  React.useEffect(() => {
    registerDialogHost((req) => {
      queueRef.current.push(req)
      showNext()
    })
    return () => registerDialogHost(null)
  }, [showNext])

  const settle = (value: boolean) => {
    if (current) current.resolve(value)
    // Affiche la requête suivante de la file (s'il y en a une).
    setCurrent(queueRef.current.shift() ?? null)
  }

  if (!current) return null

  const isAlert = current.kind === "alert"
  return (
    <ConfirmDialog
      open={true}
      onOpenChange={(o) => {
        // Fermeture (Échap / clic extérieur) = annulation pour un confirm,
        // résolution simple pour une alerte.
        if (!o) settle(isAlert ? true : false)
      }}
      title={current.title ?? (isAlert ? "Information" : "Confirmer l'action")}
      description={<span className="whitespace-pre-line">{current.message}</span>}
      confirmLabel={current.confirmLabel ?? (isAlert ? "OK" : "Confirmer")}
      cancelLabel={isAlert ? undefined : (current.cancelLabel ?? "Annuler")}
      hideCancel={isAlert}
      variant={current.variant ?? (isAlert ? "default" : "destructive")}
      onConfirm={() => settle(true)}
    />
  )
}
