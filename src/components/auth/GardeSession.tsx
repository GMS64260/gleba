"use client"

/**
 * Renvoie vers la connexion une session devenue caduque (MC3 : mot de passe
 * changé depuis un autre appareil ; compte désactivé). Le middleware ne lit
 * pas la base : sans cette garde, la page s'affichait et chaque appel d'API
 * répondait 401. Vérifie à chaque page et au retour sur l'onglet, via
 * /api/session-etat ; une erreur réseau ou serveur ne déconnecte jamais.
 */
import * as React from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

export function GardeSession() {
  const { status } = useSession()
  const pathname = usePathname()

  React.useEffect(() => {
    if (status !== "authenticated") return
    let actif = true
    const verifier = () => {
      fetch("/api/session-etat", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((etat: { valide?: boolean } | null) => {
          if (actif && etat?.valide === false) window.location.href = "/api/session-terminee"
        })
        .catch(() => {})
    }
    const auRetour = () => {
      if (document.visibilityState === "visible") verifier()
    }
    verifier()
    document.addEventListener("visibilitychange", auRetour)
    return () => {
      actif = false
      document.removeEventListener("visibilitychange", auRetour)
    }
  }, [status, pathname])

  return null
}
