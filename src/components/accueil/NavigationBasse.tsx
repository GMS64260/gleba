"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MoreHorizontal, Pencil } from "lucide-react"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useModules } from "@/hooks/use-modules"
import { ENTREES_NAVIGATION, entreeNavigationVisible, estEntreeNavigationActive, getEntreeNavigation, type EntreeNavigation } from "@/lib/navigation-principale"
import { cn } from "@/lib/utils"

const CLASSE_ENTREE = "flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg text-[10.5px] font-medium text-ardoise focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"

/** Les mêmes pages que le rail, avec Noter et la liste complète dans Plus. */
export function NavigationBasse({ className }: { className?: string }) {
  const pathname = usePathname()
  const { modules } = useModules()
  const boutique = process.env.NEXT_PUBLIC_FEATURE_BOUTIQUE === "true"
  const [ouvert, setOuvert] = React.useState(false)
  const ref = React.useRef<HTMLElement | null>(null)
  const proprietaire = React.useId()
  const entrees = ENTREES_NAVIGATION.filter(e => entreeNavigationVisible(e, modules, boutique))
  const culture = getEntreeNavigation("maraichage")
  const quatrieme = entreeNavigationVisible(culture, modules, boutique) ? culture : getEntreeNavigation("interventions")
  const directes = [getEntreeNavigation("aujourdhui"), getEntreeNavigation("jardin"), quatrieme]
  const plusActif = entrees.some(e => !directes.some(d => d.id === e.id) && estEntreeNavigationActive(pathname, e.href))

  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    const racine = document.documentElement
    racine.dataset.navigationBasseOwner = proprietaire
    const publier = () => {
      if (racine.dataset.navigationBasseOwner === proprietaire) racine.style.setProperty("--navigation-basse-h", `${Math.ceil(element.getBoundingClientRect().height)}px`)
    }
    publier()
    const observer = new ResizeObserver(publier)
    observer.observe(element)
    return () => {
      observer.disconnect()
      if (racine.dataset.navigationBasseOwner === proprietaire) {
        delete racine.dataset.navigationBasseOwner
        racine.style.removeProperty("--navigation-basse-h")
      }
    }
  }, [proprietaire])

  const entree = (e: EntreeNavigation, libelle = e.libelle) => {
    const actif = estEntreeNavigationActive(pathname, e.href)
    const Icone = e.icone
    return <Link href={e.href} aria-current={actif ? "page" : undefined} className={cn(CLASSE_ENTREE, actif && "text-foret")}>
      <Icone className={cn("h-[22px] w-[22px]", actif ? "text-sauge" : "text-ardoise")} aria-hidden />
      <span className="max-w-full truncate">{libelle}</span>
    </Link>
  }

  return (
    <nav ref={ref} data-navigation-basse className={cn("fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-lin bg-craie/95 px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 font-ui backdrop-blur-sm", className)} aria-label="Navigation">
      {entree(directes[0])}
      {entree(directes[1], "Plan")}
      <Link href="/taches" aria-current={estEntreeNavigationActive(pathname, "/taches") ? "page" : undefined} className={cn(CLASSE_ENTREE, "text-foret")} aria-label="Noter une tâche">
        <span className="-mt-5 grid h-11 w-11 place-items-center rounded-full bg-sauge text-craie shadow-fiche"><Pencil className="h-5 w-5" aria-hidden /></span>
        Noter
      </Link>
      {entree(quatrieme)}
      <Sheet open={ouvert} onOpenChange={setOuvert}>
        <SheetTrigger asChild>
          <button type="button" className={cn(CLASSE_ENTREE, plusActif && "text-foret")} aria-label="Plus de pages" aria-current={plusActif ? "page" : undefined}>
            <MoreHorizontal className={cn("h-[22px] w-[22px]", plusActif ? "text-sauge" : "text-ardoise")} aria-hidden />
            Plus
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="z-[80] max-h-[85dvh] overflow-y-auto rounded-t-2xl border-lin bg-craie font-ui text-encre">
          <SheetHeader className="text-left"><SheetTitle className="font-display text-lg font-medium">Toutes les pages</SheetTitle></SheetHeader>
          <ul className="mt-3 grid grid-cols-1 gap-1.5 pb-[env(safe-area-inset-bottom)] min-[360px]:grid-cols-2">
            {entrees.map(e => {
              const Icone = e.icone
              const actif = estEntreeNavigationActive(pathname, e.href)
              return <li key={e.id}><Link href={e.href} onClick={() => setOuvert(false)} aria-current={actif ? "page" : undefined} className={cn("flex min-h-12 items-center gap-2.5 rounded-lg border border-lin px-3 text-sm font-medium hover:bg-papier", actif && "border-sauge bg-sauge-doux text-foret")}>
                <Icone className="h-[18px] w-[18px] shrink-0 text-ardoise" aria-hidden />{e.libelle}
              </Link></li>
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </nav>
  )
}
