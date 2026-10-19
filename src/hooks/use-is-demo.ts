"use client"

/**
 * Détection du compte démo (POSTREVIEW Sprint 6).
 * Le compte `demo@gleba.fr` est utilisé sur le site public pour la démo,
 * ses tours guidés ne mémorisent pas la complétion (rejoués à chaque visite),
 * et l'écran Paramètres y désactive les gestes de niveau compte que les routes
 * refusent (`src/lib/demo-garde.ts`).
 */

import { useSession } from "next-auth/react"
import { DEMO_EMAIL, estEmailDemo } from "@/lib/demo"

export { DEMO_EMAIL }

export function useIsDemoAccount(): boolean {
  const { data: session } = useSession()
  // Même prédicat que les routes (casse et espaces tolérés).
  return estEmailDemo(session?.user?.email)
}
