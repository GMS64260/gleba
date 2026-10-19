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
    if (checked) return
    // Sans session (la route répondrait 401) ou sur une page exemptée, on
    // attend la page suivante SANS verrouiller. Verrouiller ici laissait passer
    // les inscrits par mot de passe : `/login` est exemptée, puis LoginForm
    // navigue côté client après `signIn` et ce composant, monté une seule fois
    // dans le layout, ne revérifiait plus. 12 inscrits sur 41 par mot de passe
    // avaient vu le parcours, contre 17 sur 19 par Google (2026-10-19).
    if (status !== "authenticated" || EXEMPTS.some((p) => pathname?.startsWith(p))) return
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
