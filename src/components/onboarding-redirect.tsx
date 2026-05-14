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

const EXEMPTS = ["/login", "/onboarding", "/feedback", "/raccourcis", "/aide"]

export function OnboardingRedirect() {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = React.useState(false)

  React.useEffect(() => {
    if (checked) return
    if (EXEMPTS.some((p) => pathname?.startsWith(p))) {
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
  }, [checked, pathname, router])

  return null
}
