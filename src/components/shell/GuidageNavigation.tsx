"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { cibleAide, cheminAide, type CibleAide } from "@/lib/navigation-aide"
import { getEntreeNavigation, entreeNavigationVisible } from "@/lib/navigation-principale"
import { useModules } from "@/hooks/use-modules"
import { useAccesService } from "@/hooks/use-acces-service"

const Contexte = React.createContext<{
  cible: CibleAide | null
  montrer: (href: string) => void
  fermer: () => void
}>({ cible: null, montrer: () => {}, fermer: () => {} })

export const useGuidageNavigation = () => React.useContext(Contexte)

/** Un guidage éphémère : aucun clic, changement de page ou réglage à la place de l'utilisateur. */
export function GuidageNavigationProvider({ children }: { children: React.ReactNode }) {
  const [cible, setCible] = React.useState<CibleAide | null>(null)
  const pathname = usePathname()
  const montrer = React.useCallback((href: string) => {
    const prochaine = cibleAide(href)
    setCible(prochaine ? { ...prochaine } : null)
  }, [])
  const fermer = React.useCallback(() => setCible(null), [])

  React.useEffect(() => {
    if (!cible) return
    let surligne: HTMLElement | null = null
    let animation = 0
    let focusPlace = false
    const reperer = () => {
      const racine = cible.menu ? getEntreeNavigation(cible.menu) : null
      // Une fois le module ouvert, chercher le lien réel vers le sous-écran.
      const selecteurs = [
        `a[href="${cible.href}"]`,
        ...(racine && pathname === racine.href && cible.onglet ? [`[data-module-tab="${cible.onglet}"]`] : []),
        ...(racine ? [`[data-navigation-id="${racine.id}"]`, `a[href="${racine.href}"]`] : []),
      ]
      let element: HTMLElement | undefined
      for (const selecteur of selecteurs) {
        element = Array.from(document.querySelectorAll<HTMLElement>(selecteur)).find(el => !el.closest("[data-guide-notice]") && el.getClientRects().length > 0 && !el.closest('[aria-hidden="true"], [inert]'))
        if (element) break
      }
      if (surligne !== element) {
        surligne?.removeAttribute("data-guide-cible")
        surligne = element ?? null
        surligne?.setAttribute("data-guide-cible", "true")
      }
      if (element && !focusPlace) {
        element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" })
        element.focus({ preventScroll: true })
        focusPlace = true
      }
    }
    const programmer = () => { cancelAnimationFrame(animation); animation = requestAnimationFrame(reperer) }
    programmer()
    const observer = new MutationObserver(programmer)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener("resize", programmer)
    const echapper = (event: KeyboardEvent) => { if (event.key === "Escape") fermer() }
    window.addEventListener("keydown", echapper)
    return () => {
      cancelAnimationFrame(animation)
      observer.disconnect()
      surligne?.removeAttribute("data-guide-cible")
      window.removeEventListener("resize", programmer)
      window.removeEventListener("keydown", echapper)
    }
  }, [cible, pathname, fermer])

  return <Contexte.Provider value={{ cible, montrer, fermer }}>{children}</Contexte.Provider>
}

export function GuideNavigationNotice() {
  const { cible, fermer } = useGuidageNavigation()
  const { modules } = useModules()
  const { acces } = useAccesService()
  if (!cible) return null
  const entreeMasquee = cible.menu && !entreeNavigationVisible(getEntreeNavigation(cible.menu), modules, process.env.NEXT_PUBLIC_FEATURE_BOUTIQUE === "true", acces)
  return <div data-guide-notice className="rounded-lg border border-sauge bg-sauge-doux p-3 text-sm text-encre">
    <div className="flex items-start justify-between gap-2">
      <p role="status" className="min-w-0 break-words">{cheminAide(cible)}</p>
      <button type="button" onClick={fermer} aria-label="Fermer le guidage" className="-mr-2 -mt-2 grid min-h-11 min-w-11 shrink-0 place-items-center rounded-md hover:bg-papier focus-visible:outline focus-visible:outline-2 focus-visible:outline-sauge"><X className="h-4 w-4" aria-hidden /></button>
    </div>
    {entreeMasquee && <p className="text-sm">Cette entrée n’est pas affichée dans votre menu. Vérifiez vos modules et votre accès dans <Link href="/parametres" onClick={fermer} className="underline underline-offset-2">Paramètres</Link>.</p>}
    <Link href={cible.href} onClick={fermer} className="inline-flex min-h-11 items-center text-foret underline underline-offset-2 hover:text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-sauge">Ouvrir {cible.libelle}</Link>
  </div>
}
