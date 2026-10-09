"use client"

import * as React from "react"

/**
 * Compteur de repère (mouvement 3) : à l'ouverture et après une saisie qui le
 * change, le nombre monte vers sa nouvelle valeur en 420 ms, en chiffres
 * tabulaires pour ne pas trembler. Jamais au survol. Sans animation demandée
 * (`prefers-reduced-motion`), la valeur finale s'affiche d'emblée.
 */
export interface NombreAnimeProps {
  valeur: number
  /** Mise en forme du nombre affiché (par défaut, entier en français). */
  format?: (n: number) => string
  /** Durée en ms ; `--d-slow` par défaut. */
  duree?: number
}

const FORMAT_DEFAUT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })

function animationsReduites(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
}

export function NombreAnime({ valeur, format, duree = 420 }: NombreAnimeProps) {
  // Premier rendu : la valeur cible, pour que le HTML serveur soit juste.
  const [affiche, setAffiche] = React.useState(valeur)
  const precedent = React.useRef(valeur)
  const trame = React.useRef<number | null>(null)

  React.useEffect(() => {
    const depart = precedent.current
    precedent.current = valeur
    if (depart === valeur) return
    if (animationsReduites()) {
      setAffiche(valeur)
      return
    }
    const t0 = performance.now()
    const decimales = Number.isInteger(valeur) && Number.isInteger(depart) ? 0 : 1
    const pas = (t: number) => {
      const x = Math.min(1, (t - t0) / duree)
      // Décélération en arrivant (même esprit que --e-out).
      const e = 1 - Math.pow(1 - x, 3)
      const v = depart + (valeur - depart) * e
      setAffiche(x >= 1 ? valeur : Number(v.toFixed(decimales)))
      if (x < 1) trame.current = requestAnimationFrame(pas)
    }
    trame.current = requestAnimationFrame(pas)
    return () => {
      if (trame.current !== null) cancelAnimationFrame(trame.current)
    }
  }, [valeur, duree])

  return <span className="tabular-nums">{(format ?? ((n) => FORMAT_DEFAUT.format(n)))(affiche)}</span>
}
