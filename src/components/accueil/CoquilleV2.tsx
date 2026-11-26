"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

import { useExploitation } from "@/hooks/use-exploitation"

import { AccueilRail } from "./AccueilRail"
import { NavigationBasse } from "./NavigationBasse"
import { AppTopBar } from "@/components/shell/AppTopBar"
import { estCoquilleV2Active } from "@/lib/navigation-principale"

/**
 * Coquille commune à toute page connectée : le rail, la barre supérieure et
 * la navigation basse sont uniques dans le layout. `ModuleTabBar` conserve
 * les sous-onglets.
 */
export function CoquilleV2() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { contexte } = useExploitation()
  const actif = estCoquilleV2Active(pathname, Boolean(session?.user))

  React.useEffect(() => {
    document.documentElement.classList.toggle("coquille-v2", actif)
    return () => document.documentElement.classList.remove("coquille-v2")
  }, [actif])

  if (!actif || !session?.user) return null
  return <>
    <AccueilRail nomFerme={contexte?.exploitation.nom ?? null} className="fixed inset-y-0 left-0 z-40 hidden w-[200px] lg:flex" />
    <AppTopBar user={session.user} />
    <NavigationBasse className="lg:hidden" />
  </>
}
