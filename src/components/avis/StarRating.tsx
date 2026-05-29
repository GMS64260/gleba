"use client"

/**
 * Notation par étoiles, réutilisable.
 * - Mode lecture (sans onChange) : supporte les valeurs fractionnaires (moyennes)
 *   via un remplissage partiel.
 * - Mode saisie (avec onChange) : 5 étoiles cliquables (entiers) ; re-cliquer la
 *   même étoile efface la note.
 */

import * as React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarRatingProps {
  value?: number | null
  onChange?: (v: number | null) => void
  size?: number
  className?: string
  label?: string
}

const STARS = [1, 2, 3, 4, 5]

export function StarRating({ value, onChange, size = 18, className, label }: StarRatingProps) {
  const [hover, setHover] = React.useState<number | null>(null)
  const interactive = typeof onChange === "function"
  const v = value ?? 0

  if (interactive) {
    const shown = hover ?? v
    return (
      <div className={cn("flex items-center gap-0.5", className)} role="radiogroup" aria-label={label}>
        {STARS.map((n) => (
          <button
            key={n}
            type="button"
            className="p-0.5 transition-transform hover:scale-110"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onChange!(value === n ? null : n)}
            aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
            aria-pressed={v === n}
          >
            <Star
              style={{ width: size, height: size }}
              className={cn(
                "transition-colors",
                n <= shown ? "fill-amber-400 text-amber-400" : "fill-transparent text-slate-300"
              )}
            />
          </button>
        ))}
      </div>
    )
  }

  const pct = Math.max(0, Math.min(100, (v / 5) * 100))
  return (
    <div className={cn("relative inline-flex shrink-0", className)} title={label} aria-label={label}>
      <div className="flex">
        {STARS.map((n) => (
          <Star key={n} style={{ width: size, height: size }} className="fill-transparent text-slate-300" />
        ))}
      </div>
      <div className="absolute inset-0 flex overflow-hidden" style={{ width: `${pct}%` }}>
        {STARS.map((n) => (
          <Star
            key={n}
            style={{ width: size, height: size, minWidth: size }}
            className="fill-amber-400 text-amber-400"
          />
        ))}
      </div>
    </div>
  )
}
