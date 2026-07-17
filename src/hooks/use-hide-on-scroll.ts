"use client"

/**
 * Masquage au scroll du header global — chantier UX 2026-07 (retour Guillaume).
 *
 * En descendant, le header s'efface pour laisser la place au contenu (seule
 * la barre d'onglets du module reste collée en haut) ; dès qu'on remonte,
 * il réapparaît pour permettre de changer de module.
 *
 * Hystérésis de 4 px pour éviter le clignotement, et jamais masqué tant
 * qu'on n'a pas dépassé `threshold` (hauteur du header).
 */

import * as React from "react"

export function useHideOnScroll(threshold = 80): boolean {
  const [hidden, setHidden] = React.useState(false)

  React.useEffect(() => {
    let lastY = window.scrollY
    let ticking = false

    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - lastY
        if (Math.abs(delta) > 4) {
          if (y <= threshold) {
            setHidden(false)
          } else {
            setHidden(delta > 0)
          }
          lastY = y
        }
        ticking = false
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [threshold])

  return hidden
}
