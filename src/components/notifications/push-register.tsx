'use client'

import { useEffect } from "react"

/** Enregistre le service worker dédié aux notifications sans interférer avec l'élevage. */
export function PushRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    // Scope dédié : le service worker d'élevage utilise lui aussi la racine.
    // Deux workers racine se remplaceraient mutuellement dans le navigateur.
    navigator.serviceWorker.register("/sw-notifications.js", { scope: "/notifications-push/" }).catch(() => {})
  }, [])

  return null
}
