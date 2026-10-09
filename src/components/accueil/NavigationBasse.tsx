"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bird, CalendarCheck, CloudSun, Map as MapIcon, Megaphone, MoreHorizontal, Pencil, Settings, Sprout, Store, TreeDeciduous, Wallet } from "lucide-react"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useModules } from "@/hooks/use-modules"
import type { ModuleId } from "@/lib/modules"
import { cn } from "@/lib/utils"

/**
 * Navigation basse du téléphone (maquette retenue, L4) : cinq entrées,
 * « Noter » au centre, « Plus » ouvre la liste complète (modules, boutique,
 * communauté, réglages). Toute action de l'en-tête reste à deux gestes.
 */
const CLASSE_ENTREE =
  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[10.5px] font-medium text-ardoise focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"

interface Lien {
  href: string
  libelle: string
  icone: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  module?: ModuleId
}

const PLUS: Lien[] = [
  { href: "/verger", libelle: "Verger", icone: TreeDeciduous, module: "verger" },
  { href: "/elevage", libelle: "Élevage", icone: Bird, module: "elevage" },
  { href: "/comptabilite", libelle: "Comptabilité", icone: Wallet, module: "comptabilite" },
  { href: "/meteo", libelle: "Météo", icone: CloudSun },
  { href: "/communaute", libelle: "Communauté", icone: Megaphone },
  { href: "/parametres", libelle: "Réglages", icone: Settings },
]

export function NavigationBasse({ className }: { className?: string }) {
  const pathname = usePathname()
  const { modules } = useModules()
  const boutique = process.env.NEXT_PUBLIC_FEATURE_BOUTIQUE === "true"
  const [ouvert, setOuvert] = React.useState(false)

  const entree = (href: string, libelle: string, Icone: Lien["icone"]) => {
    const actif = pathname === href
    return (
      <Link href={href} aria-current={actif ? "page" : undefined} className={cn(CLASSE_ENTREE, actif && "text-foret")}>
        <Icone className={cn("h-[22px] w-[22px]", actif ? "text-sauge" : "text-ardoise")} aria-hidden />
        {libelle}
      </Link>
    )
  }

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-lin bg-craie/95 px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-sm",
        className,
      )}
      aria-label="Navigation"
    >
      {entree("/aujourdhui", "Aujourd'hui", CalendarCheck)}
      {entree("/jardin", "Plan", MapIcon)}
      <Link href="/taches" className={cn(CLASSE_ENTREE, "text-foret")} aria-label="Noter une tâche">
        <span className="-mt-5 grid h-11 w-11 place-items-center rounded-full bg-sauge text-craie shadow-fiche">
          <Pencil className="h-5 w-5" aria-hidden />
        </span>
        Noter
      </Link>
      {entree("/maraichage", "Cultures", Sprout)}
      <Sheet open={ouvert} onOpenChange={setOuvert}>
        <SheetTrigger asChild>
          <button type="button" className={CLASSE_ENTREE} aria-label="Plus de pages">
            <MoreHorizontal className="h-[22px] w-[22px] text-ardoise" aria-hidden />
            Plus
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl border-lin bg-craie font-ui text-encre">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-lg font-medium">Toutes les pages</SheetTitle>
          </SheetHeader>
          <ul className="mt-3 grid grid-cols-2 gap-1.5 pb-[env(safe-area-inset-bottom)]">
            {[...(boutique ? [{ href: "/boutique", libelle: "Boutique", icone: Store } as Lien] : []), ...PLUS]
              .filter((l) => !l.module || modules.includes(l.module))
              .map((l) => {
                const Icone = l.icone
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOuvert(false)}
                      className="flex min-h-12 items-center gap-2.5 rounded-lg border border-lin px-3 text-sm font-medium hover:bg-papier"
                    >
                      <Icone className="h-[18px] w-[18px] text-ardoise" aria-hidden />
                      {l.libelle}
                    </Link>
                  </li>
                )
              })}
          </ul>
        </SheetContent>
      </Sheet>
    </nav>
  )
}
