"use client"

/**
 * Header global partagé (shell applicatif) — chantier UX 2026-07, palier 1.
 *
 * Reprend à l'identique le header « complet » des homes de module
 * (logo + météo + ModulesNav + boutique + paramètres + compte) pour les
 * sous-pages qui n'affichaient qu'un header léger (retour + titre) et
 * faisaient perdre la navigation inter-modules et le menu utilisateur.
 *
 * Le titre de page, le bouton retour et les actions contextuelles vivent
 * dans une rangée sous ce header, à la charge de chaque page.
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/auth/UserMenu"
import { ModulesNav } from "@/components/auth/ModulesNav"
import { BoutiqueHeaderButton } from "@/components/auth/BoutiqueHeaderButton"
import { HeaderMeteoWidget } from "@/components/meteo/HeaderMeteoWidget"
import type { ModuleId } from "@/lib/modules"

interface AppHeaderProps {
  /** Module courant, pour l'état actif de ModulesNav ; absent sur les pages transverses (ex. /meteo) */
  current?: ModuleId
  /** Affiche la lune dans le widget météo (activé sur les homes) */
  showLune?: boolean
}

export function AppHeader({ current, showLune = false }: AppHeaderProps) {
  const { data: session } = useSession()

  return (
    <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-2 max-w-[1600px] flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity flex-shrink-0">
            <Image
              src="/gleba-logo.png"
              alt="Gleba"
              width={120}
              height={80}
              className="h-10 w-auto rounded-lg"
              priority
            />
          </Link>
          {session?.user && <HeaderMeteoWidget showLune={showLune} />}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {session?.user && <ModulesNav current={current} />}
          {session?.user && <BoutiqueHeaderButton />}
          <Link href="/parametres">
            <Button variant="ghost" size="sm" aria-label="Paramètres">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          {session?.user && <UserMenu user={session.user} />}
        </div>
      </div>
    </header>
  )
}

/**
 * Rangée de titre sous l'AppHeader : retour, icône, titre, actions.
 * Extrait le pattern répété des anciens headers légers pour que les
 * sous-pages restent homogènes après migration.
 */
export function PageToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b bg-white/70 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2 flex-wrap max-w-[1600px]">
        {children}
      </div>
    </div>
  )
}
