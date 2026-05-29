/**
 * Dialogue global impératif rendu DANS le DOM (pas une fenêtre système).
 *
 * Feedback testeur 2026-05-26 : les window.confirm()/alert() natifs sont
 * invisibles des agents de test automatisés (auto-rejet) et bloquants.
 * On les remplace partout par confirmDialog()/alertDialog(), qui affichent
 * une modale React (ConfirmDialog) visible dans le DOM.
 *
 * Usage (depuis n'importe quel handler, sans hook) :
 *   if (!(await confirmDialog("Supprimer cet élément ?"))) return
 *   await alertDialog("Erreur lors de la sauvegarde")
 *
 * Un <GlobalDialogHost/> monté une fois au layout racine consomme la file.
 * Si le host n'est pas encore monté (SSR, early), on retombe sur le natif.
 */

export type GlobalDialogVariant = "destructive" | "warning" | "default"

export interface GlobalDialogRequest {
  id: number
  kind: "confirm" | "alert"
  message: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: GlobalDialogVariant
  resolve: (value: boolean) => void
}

type PushFn = (req: GlobalDialogRequest) => void

let pushFn: PushFn | null = null
let counter = 0

/** Appelé par le host React une fois monté. */
export function registerDialogHost(fn: PushFn | null) {
  pushFn = fn
}

export interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: GlobalDialogVariant
}

/** Confirmation in-app. Résout à true si confirmé, false sinon. */
export function confirmDialog(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!pushFn) {
      // Fallback (host non monté) : reste fonctionnel.
      if (typeof window !== "undefined") resolve(window.confirm(message))
      else resolve(false)
      return
    }
    pushFn({
      id: ++counter,
      kind: "confirm",
      message,
      title: opts.title,
      confirmLabel: opts.confirmLabel,
      cancelLabel: opts.cancelLabel,
      variant: opts.variant ?? "destructive",
      resolve,
    })
  })
}

/** Alerte in-app (un seul bouton OK). */
export function alertDialog(message: string, opts: { title?: string } = {}): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!pushFn) {
      if (typeof window !== "undefined") window.alert(message)
      resolve()
      return
    }
    pushFn({
      id: ++counter,
      kind: "alert",
      message,
      title: opts.title,
      variant: "default",
      resolve: () => resolve(),
    })
  })
}
