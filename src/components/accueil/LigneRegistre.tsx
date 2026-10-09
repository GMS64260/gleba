import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { type EtatRegistre } from "./PastilleEtat"

/**
 * Ligne de registre : liseré d'état, libellé (la planche ou l'objet d'abord),
 * métadonnées, pastille d'état et une seule action. Remplace, dans l'accueil
 * v2, les lignes à fond rouge et les badges « Critique ».
 *
 * Palier 1 (2026-10-08) : posée, utilisée par personne. Cible tactile de
 * l'action : 44 px minimum.
 */
export interface ActionLigne {
  libelle: string
  /** Navigation : rendue en lien. */
  href?: string
  /** Sinon, bouton. */
  onClick?: () => void
  disabled?: boolean
}

export interface LigneRegistreProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  etat: EtatRegistre
  titre: React.ReactNode
  /** Métadonnées courtes, séparées par un point médian à l'affichage. */
  meta?: React.ReactNode[]
  /** Pastille d'état ou tout autre élément à droite du texte. */
  pastille?: React.ReactNode
  action?: ActionLigne
}

const LISERES: Record<EtatRegistre, string> = {
  critique: "bg-argile",
  attention: "bg-paille",
  ok: "bg-prairie",
  info: "bg-eau",
  neutre: "bg-lin",
}

const CLASSES_ACTION =
  "inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-lg border border-lin bg-craie px-3 text-sm font-semibold text-sauge transition-colors duration-fast hover:bg-sauge-doux focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge disabled:opacity-50"

function ActionRegistre({ action }: { action: ActionLigne }) {
  if (action.href && !action.disabled) {
    return (
      <Link href={action.href} className={CLASSES_ACTION}>
        {action.libelle}
      </Link>
    )
  }
  return (
    <button type="button" onClick={action.onClick} disabled={action.disabled} className={CLASSES_ACTION}>
      {action.libelle}
    </button>
  )
}

export function LigneRegistre({ etat, titre, meta, pastille, action, className, ...props }: LigneRegistreProps) {
  const metas = (meta ?? []).filter((m) => m !== null && m !== undefined && m !== "")
  return (
    <div
      data-etat={etat}
      className={cn(
        "grid grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-3 border-b border-lin-doux py-3 pl-3 pr-4 text-sm text-encre last:border-b-0",
        className,
      )}
      {...props}
    >
      <i aria-hidden className={cn("block h-9 w-1 rounded-sm transition-colors duration-fast", LISERES[etat])} />
      <div className="min-w-0">
        <div className="font-semibold leading-tight">{titre}</div>
        {metas.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[12.5px] leading-5 text-ardoise">
            {metas.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {i > 0 && <span aria-hidden>·</span>}
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
      {(pastille || action) && (
        <div className="flex items-center gap-2">
          {pastille}
          {action && <ActionRegistre action={action} />}
        </div>
      )}
    </div>
  )
}
