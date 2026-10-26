"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useModules } from "@/hooks/use-modules"
import { ENTREES_PRINCIPALES, ENTREES_SECONDAIRES, entreeNavigationVisible, estEntreeNavigationActive, type EntreeNavigation } from "@/lib/navigation-principale"
import { cn } from "@/lib/utils"

/**
 * Rail de navigation de l'accueil v2 (maquette retenue, livraison L4) :
 * marque, entrées, réglages, carte de la ferme. Mêmes URL que l'en-tête
 * historique, pour les comptes en v2 seulement ; `ModuleTabBar` continue de
 * servir les sous-onglets de chaque module.
 */
const CLASSE_LIEN =
  "flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-encre hover:bg-papier focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"

export interface AccueilRailProps {
  nomFerme: string | null;
  /** « Demo-A · 3 parcelles » */
  sousTitreFerme?: string | null
  className?: string
}

export function AccueilRail({ nomFerme, sousTitreFerme, className }: AccueilRailProps) {
  const { modules } = useModules()
  const pathname = usePathname()
  const boutique = process.env.NEXT_PUBLIC_FEATURE_BOUTIQUE === "true"

  const lien = (e: EntreeNavigation) => {
    const actif = estEntreeNavigationActive(pathname, e.href)
    const Icone = e.icone
    return (
      <Link key={e.href} href={e.href} aria-current={actif ? "page" : undefined} className={cn(CLASSE_LIEN, actif && "bg-sauge-doux text-foret hover:bg-sauge-doux")}>
        <Icone className={cn("h-[18px] w-[18px] shrink-0", actif ? "text-sauge" : "text-ardoise")} aria-hidden />
        {e.libelle}
      </Link>
    )
  }

  return (
    <aside className={cn("flex h-full flex-col gap-1 overflow-y-auto border-r border-lin bg-craie px-3 pt-4 pb-6", className)} aria-label="Navigation principale">
      <Link href="/aujourdhui" className="mb-3 flex items-center gap-2.5 px-2 font-display text-[22px] font-semibold text-foret">
        <Image src="/gleba-logo.png" alt="" width={120} height={80} className="h-7 w-auto rounded-md" priority />
        Gleba
      </Link>
      {ENTREES_PRINCIPALES.filter(e => entreeNavigationVisible(e, modules, boutique)).map(lien)}
      <div className="my-2 h-px bg-lin" aria-hidden />
      {ENTREES_SECONDAIRES.filter(e => entreeNavigationVisible(e, modules, boutique)).map(lien)}
      {nomFerme && (
        <div className="mt-auto flex items-center gap-2.5 rounded-lg border border-lin px-2.5 py-2 text-[13px]">
          <span aria-hidden className="h-7 w-7 shrink-0 rounded-md border border-lin bg-paille-doux" />
          <div className="min-w-0">
            <b className="block truncate font-semibold">{nomFerme}</b>
            {sousTitreFerme && <span className="block truncate text-xs text-ardoise">{sousTitreFerme}</span>}
          </div>
        </div>
      )}
    </aside>
  )
}
