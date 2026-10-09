"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

import { useExploitation } from "@/hooks/use-exploitation"
import { useVersionAccueil } from "@/hooks/use-version-accueil"

import { AccueilRail } from "./AccueilRail"

/**
 * Shell de l'accueil v2 sur toutes les pages (livraison L4) : pour un compte
 * passé en v2, le rail de navigation remplace l'en-tête historique sur grand
 * écran, partout ; le contenu est décalé de la largeur du rail par la classe
 * `coquille-v2` posée sur <html> (globals.css). Sur téléphone, l'en-tête
 * historique reste sur les pages de modules ; `/aujourdhui` a sa navigation
 * basse. `ModuleTabBar` continue de servir les sous-onglets.
 */
const CHEMINS_SANS_SHELL = ["/login", "/register", "/mot-de-passe-oublie", "/reset-password", "/onboarding", "/invitation", "/impersonation", "/admin", "/apercu"]

export function estCheminSansShell(pathname: string | null): boolean {
  if (!pathname) return true
  return CHEMINS_SANS_SHELL.some((p) => pathname === p || pathname.startsWith(p + "/"))
}

export function CoquilleV2() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { version } = useVersionAccueil()
  const { contexte } = useExploitation()
  const actif = Boolean(session?.user) && !estCheminSansShell(pathname) && (version === "v2" || pathname === "/aujourdhui")

  React.useEffect(() => {
    document.documentElement.classList.toggle("coquille-v2", actif)
    return () => document.documentElement.classList.remove("coquille-v2")
  }, [actif])

  if (!actif) return null
  return <AccueilRail nomFerme={contexte?.exploitation.nom ?? null} className="fixed inset-y-0 left-0 z-40 hidden w-[200px] lg:flex" />
}
