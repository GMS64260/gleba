import * as React from "react"
import { CheckCircle, Clock, Info, Warning, WarningCircle } from "@/lib/phosphor-icons"

import { cn } from "@/lib/utils"

/**
 * Étiquette d'état de la charte « carnet de ferme » : forme, icône et verbe
 * en plus de la couleur (la couleur ne porte jamais seule l'information).
 *
 * Posée au palier 1 (2026-10-08), consommée par la ligne de registre de
 * l'accueil v2. Aucun écran existant ne l'utilise encore.
 */
export type EtatRegistre = "critique" | "attention" | "ok" | "info" | "neutre"

export const ETATS_REGISTRE: readonly EtatRegistre[] = ["critique", "attention", "ok", "info", "neutre"]

const STYLES: Record<EtatRegistre, string> = {
  critique: "bg-argile-doux text-argile",
  attention: "bg-paille-doux text-ocre",
  ok: "bg-sauge-doux text-prairie",
  info: "bg-eau-doux text-eau",
  neutre: "bg-lin-doux text-ardoise",
}

const ICONES: Record<EtatRegistre, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  critique: WarningCircle,
  attention: Warning,
  ok: CheckCircle,
  info: Info,
  neutre: Clock,
}

export interface PastilleEtatProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  etat: EtatRegistre
  /** Verbe ou état court : « À arroser », « Fait », « Sous 7 j ». */
  libelle: string
  /** Icône de remplacement ; par défaut, celle de l'état. */
  icone?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
}

export function PastilleEtat({ etat, libelle, icone, className, ...props }: PastilleEtatProps) {
  const Icone = icone ?? ICONES[etat]
  return (
    <span
      data-etat={etat}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5",
        STYLES[etat],
        className,
      )}
      {...props}
    >
      <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {libelle}
    </span>
  )
}
