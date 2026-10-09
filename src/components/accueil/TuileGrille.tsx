import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Grille bento de l'accueil : une colonne sur mobile (les tuiles s'empilent
 * dans l'ordre), douze colonnes à partir de lg, où chaque Tuile pose sa
 * largeur. Palier 1 (2026-10-08).
 */
export type TuileGrilleProps = React.HTMLAttributes<HTMLDivElement>

export function TuileGrille({ className, children, ...props }: TuileGrilleProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-12", className)} {...props}>
      {children}
    </div>
  )
}

/** Rangée de repères : deux par ligne sur mobile, cinq à partir de lg. */
export function RepereRangee({ className, children, ...props }: TuileGrilleProps) {
  return (
    <div
      className={cn(
        // Sur deux colonnes, un dernier repère impair prend toute la largeur au lieu de rester seul.
        "grid grid-cols-2 gap-2.5 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2 sm:grid-cols-3 lg:grid-cols-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
