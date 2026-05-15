"use client"

/**
 * Tour guidé interactif basé sur Shepherd.js (PROMPT 22 §3).
 *
 * - Démarrage automatique au premier passage post-onboarding
 * - Re-déclenchable depuis /aide (bouton "Relancer le tour guidé")
 * - Mémorise l'état dans localStorage (`gleba.tour.<key>.done`)
 *
 * L'instance Shepherd est créée à la demande et dynamiquement importée
 * pour éviter d'embarquer Shepherd dans le bundle des pages où il n'est
 * pas utilisé.
 */

import * as React from "react"
import { usePathname } from "next/navigation"

interface TourStep {
  id: string
  title: string
  text: string
  attachTo?: { element: string; on: "top" | "right" | "bottom" | "left" }
}

interface GuidedTourProps {
  /** Clé localStorage pour mémoriser la complétion. */
  storageKey: string
  /** Étapes du tour. */
  steps: TourStep[]
  /** Si true, démarre automatiquement au mount (sauf si déjà complété). */
  autoStart?: boolean
  /**
   * POSTREVIEW Sprint 6 — Si true (typiquement compte démo `demo@gleba.fr`),
   * le tour est rejoué à chaque visite : on ignore le flag de complétion
   * (ni lecture ni écriture). Le bouton "Terminer" ferme la session courante
   * mais le tour réapparaîtra au prochain mount.
   */
  alwaysShow?: boolean
}

declare global {
  // eslint-disable-next-line no-var
  var __glebaTourRunning__: boolean | undefined
}

export function GuidedTour({ storageKey, steps, autoStart = true, alwaysShow = false }: GuidedTourProps) {
  const pathname = usePathname()

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (globalThis.__glebaTourRunning__) return
    const flagKey = `gleba.tour.${storageKey}.done`
    // Compte démo : on ignore le flag localStorage pour qu'un visiteur
    // anonyme voie le tour une fois par session. Mais on utilise un flag
    // `sessionStorage` (lié à l'onglet) pour ne pas le réafficher au
    // refresh / changement de page dans la même session — sinon c'est
    // invasif. La session se ferme à la fermeture de l'onglet.
    const sessionFlagKey = `gleba.tour.${storageKey}.dismissed`
    if (!alwaysShow && autoStart && localStorage.getItem(flagKey)) return
    if (alwaysShow && autoStart && sessionStorage.getItem(sessionFlagKey)) return

    let cancelled = false
    let tour: { complete: () => void; cancel: () => void } | null = null

    ;(async () => {
      // Import dynamique côté client uniquement
      const Shepherd = (await import("shepherd.js")).default
      // CSS Shepherd (chargement à la volée pour éviter import statique global)
      if (!document.querySelector('link[data-shepherd]')) {
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = "https://cdn.jsdelivr.net/npm/shepherd.js@15/dist/css/shepherd.css"
        link.setAttribute("data-shepherd", "1")
        document.head.appendChild(link)
      }
      if (cancelled) return

      const instance = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
          classes: "gleba-tour",
          scrollTo: { behavior: "smooth", block: "center" },
          cancelIcon: { enabled: true, label: "Fermer" },
        },
      })

      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]
        instance.addStep({
          id: s.id,
          title: s.title,
          text: s.text,
          attachTo: s.attachTo,
          buttons: [
            ...(i > 0
              ? [
                  {
                    text: "Précédent",
                    action: () => instance.back(),
                    classes: "shepherd-button-secondary",
                  },
                ]
              : []),
            {
              text: i === steps.length - 1 ? "Terminer" : "Suivant",
              action: () =>
                i === steps.length - 1 ? instance.complete() : instance.next(),
            },
          ],
        })
      }

      instance.on("complete", () => {
        // Compte normal → flag permanent localStorage.
        // Compte démo → flag de session uniquement (réapparaît au prochain
        // visiteur anonyme qui ouvre un nouvel onglet, mais pas au refresh).
        if (!alwaysShow) {
          localStorage.setItem(flagKey, new Date().toISOString())
        } else {
          sessionStorage.setItem(sessionFlagKey, new Date().toISOString())
        }
        globalThis.__glebaTourRunning__ = false
      })
      instance.on("cancel", () => {
        // Fermer la croix doit aussi masquer le tour pour la session courante,
        // sinon le moindre refresh sur le compte démo le relance.
        if (alwaysShow) {
          sessionStorage.setItem(sessionFlagKey, new Date().toISOString())
        }
        globalThis.__glebaTourRunning__ = false
      })

      globalThis.__glebaTourRunning__ = true
      tour = instance
      instance.start()
    })()

    return () => {
      cancelled = true
      if (tour) {
        tour.cancel()
      }
      globalThis.__glebaTourRunning__ = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, alwaysShow])

  return null
}

/** Helper pour re-déclencher un tour (utilisé par /aide). */
export function resetTour(storageKey: string) {
  if (typeof window === "undefined") return
  localStorage.removeItem(`gleba.tour.${storageKey}.done`)
  // Le flag de session du compte démo doit aussi disparaître sinon le
  // bouton « Voir le tour » de /aide reste sans effet sur la démo.
  sessionStorage.removeItem(`gleba.tour.${storageKey}.dismissed`)
}
