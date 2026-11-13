"use client"

import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useEffect, useRef } from "react"
import { envoyerPageVue } from "@/lib/mesure-audience/envoi"

/** Une requête par page publique, uniquement après résolution de la session. */
export function MesureAudience() {
  const chemin = usePathname()
  const { status } = useSession()
  const dernierePage = useRef<string | null>(null)

  useEffect(() => {
    if (status !== "unauthenticated") {
      dernierePage.current = null
      return
    }
    if (!chemin || dernierePage.current === chemin) return
    dernierePage.current = envoyerPageVue(chemin) ? chemin : null
  }, [chemin, status])

  return null
}
