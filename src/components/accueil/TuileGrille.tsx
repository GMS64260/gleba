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

/**
 * Rangée de repères : sur téléphone une rangée qui défile (maquette :
 * « rangée défilante de pastilles sous la date »), trois colonnes dès sm, cinq
 * à partir de lg.
 */
export function RepereRangee({ className, children, ...props }: TuileGrilleProps) {
  return (
    <div
      className={cn(
        "-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&>*]:min-w-[156px] [&>*]:shrink-0 [&::-webkit-scrollbar]:hidden",
        "sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 sm:[&>*]:min-w-0 lg:grid-cols-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
