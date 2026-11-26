"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useAccesService } from "@/hooks/use-acces-service"
import { useModules } from "@/hooks/use-modules"
import { destinationsNoter, estEntreeNavigationActive } from "@/lib/navigation-principale"

/**
 * Bouton « Noter » : il ouvre la saisie de l'univers de la ferme (cultures,
 * verger, élevage). Avec un seul univers, ou depuis une page de l'un d'eux,
 * c'est un lien direct ; sinon il propose le choix (retour FB-6S0AR2).
 */
export function LienNoter({ className, children }: { className?: string; children?: React.ReactNode }) {
  const pathname = usePathname()
  const { modules, loading } = useModules()
  const { acces } = useAccesService()
  const [ouvert, setOuvert] = React.useState(false)

  // Tant que les univers de la ferme ne sont pas lus, la liste est vide ou
  // complète par défaut : y mener enverrait un éleveur aux tâches du
  // maraîchage. Le bouton attend, sans destination.
  if (loading || !acces) {
    return (
      <button type="button" data-noter="attente" aria-busy="true" aria-disabled="true" aria-label="Noter" className={className}>
        {children}
      </button>
    )
  }
  const destinations = destinationsNoter(pathname, modules)

  if (destinations.length === 1) {
    const { href, libelle } = destinations[0]
    const chemin = href.split("?")[0]
    // `/verger?tab=…` n'est pas une page de saisie à part : pas de « page courante ».
    const actif = chemin === href && estEntreeNavigationActive(pathname, chemin)
    return (
      <Link href={href} data-noter={destinations[0].module} aria-current={actif ? "page" : undefined} aria-label={`Noter · ${libelle}`} className={className}>
        {children}
      </Link>
    )
  }

  return (
    <Sheet open={ouvert} onOpenChange={setOuvert}>
      <SheetTrigger asChild>
        <button type="button" data-noter="choix" aria-label="Noter : choisir l’univers" className={className}>
          {children}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="z-[80] max-h-[85dvh] overflow-y-auto rounded-t-2xl border-lin bg-craie font-ui text-encre">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-lg font-medium">Noter</SheetTitle>
          <SheetDescription className="text-sm text-ardoise">Dans quel univers ?</SheetDescription>
        </SheetHeader>
        <ul className="mt-3 grid gap-1.5 pb-[env(safe-area-inset-bottom)]">
          {destinations.map(d => {
            const Icone = d.icone
            return (
              <li key={d.module}>
                <Link href={d.href} data-noter={d.module} onClick={() => setOuvert(false)} className="flex min-h-14 items-center gap-3 rounded-lg border border-lin px-3 py-2 hover:bg-papier focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge">
                  <Icone className="h-5 w-5 shrink-0 text-sauge" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-encre">{d.libelle}</span>
                    <span className="block text-xs text-ardoise">{d.detail}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
