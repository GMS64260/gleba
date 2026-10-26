"use client"

import * as React from "react"
import Link from "next/link"
import { BarreCommande } from "@/components/accueil/BarreCommande"
import { UserMenu } from "@/components/auth/UserMenu"
import { HeaderMeteoWidget } from "@/components/meteo/HeaderMeteoWidget"
import { LuneDuJour } from "@/components/lunaire/LuneDuJour"
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll"
import { cn } from "@/lib/utils"

/** Une seule barre commune ; les titres et actions appartiennent aux pages. */
export function AppTopBar({ user }: { user: React.ComponentProps<typeof UserMenu>["user"] }) {
  const hidden = useHideOnScroll()
  const ref = React.useRef<HTMLElement | null>(null)
  const proprietaire = React.useId()
  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    const racine = document.documentElement
    racine.dataset.appHeaderOwner = proprietaire
    const publier = () => {
      if (racine.dataset.appHeaderOwner !== proprietaire) return
      const hauteur = `${Math.ceil(element.getBoundingClientRect().height)}px`
      racine.style.setProperty("--app-header-h", hauteur)
      racine.style.setProperty("--app-header-visible-h", hidden ? "0px" : hauteur)
    }
    publier()
    const observer = new ResizeObserver(publier)
    observer.observe(element)
    return () => {
      observer.disconnect()
      if (racine.dataset.appHeaderOwner === proprietaire) {
        delete racine.dataset.appHeaderOwner
        racine.style.removeProperty("--app-header-h")
        racine.style.removeProperty("--app-header-visible-h")
      }
    }
  }, [hidden, proprietaire])

  return <header ref={ref} data-app-topbar className={cn("sticky top-0 z-50 border-b border-lin bg-craie/95 font-ui text-encre backdrop-blur-sm transition-transform duration-200 motion-reduce:transition-none", hidden ? "-translate-y-full" : "translate-y-0")}>
    <div className="mx-auto flex min-h-16 w-full min-w-0 max-w-[1600px] items-center gap-2 px-4 py-2 lg:gap-4 lg:px-6">
      <Link href="/aujourdhui" className="flex min-h-11 shrink-0 items-center font-display text-xl font-semibold text-foret lg:hidden" aria-label="Gleba, aujourd’hui">Gleba</Link>
      <BarreCommande compact className="flex-1 lg:max-w-[560px]" />
      <div className="ml-auto hidden shrink-0 items-center gap-3 lg:flex"><HeaderMeteoWidget /><LuneDuJour /></div>
      <div className="shrink-0 [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:max-w-[10rem] [&_button>span]:truncate"><UserMenu user={user} /></div>
    </div>
  </header>
}
