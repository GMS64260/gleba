"use client"

/**
 * Détection nouveau compte + redirection /onboarding (PROMPT 22 §1).
 *
 * Monté dans le layout root, ce composant interroge /api/onboarding à
 * la première session. Si `completed=false`, redirige vers /onboarding
 * (sauf si déjà sur /onboarding ou /login).
 */

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

const EXEMPTS = ["/login", "/onboarding", "/feedback", "/raccourcis", "/aide"]

export function OnboardingRedirect() {
  const router = useRouter()
  const pathname = usePathname()
  const { status } = useSession()
  const [checked, setChecked] = React.useState(false)

  React.useEffect(() => {
    if (checked || status === "loading") return
    // Visiteur sans session : la route répondrait 401, rien à vérifier.
    if (status !== "authenticated" || EXEMPTS.some((p) => pathname?.startsWith(p))) {
      setChecked(true)
      return
    }
    fetch("/api/onboarding", { method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && j.completed === false) {
          router.replace("/onboarding")
        }
      })
      .catch(() => {
        // Si l'API échoue (utilisateur non auth, par exemple), on laisse passer
      })
      .finally(() => setChecked(true))
  }, [checked, status, pathname, router])

  return null
}
