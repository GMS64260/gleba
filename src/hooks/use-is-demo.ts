"use client"

/**
 * Détection du compte démo (POSTREVIEW Sprint 6).
 * Le compte `demo@gleba.fr` est utilisé sur le site public pour la démo,
 * ses tours guidés ne mémorisent pas la complétion (rejoués à chaque visite).
 */

import { useSession } from "next-auth/react"

export const DEMO_EMAIL = "demo@gleba.fr"

export function useIsDemoAccount(): boolean {
  const { data: session } = useSession()
  return session?.user?.email === DEMO_EMAIL
}
