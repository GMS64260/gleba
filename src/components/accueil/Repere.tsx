import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * Repère (mesure agricole) : valeur en chiffres tabulaires, unité secondaire,
 * tendance ou détail sur une ligne, sur fond blanc, sans gradient. Remplace
 * les tuiles KPI saturées dans l'accueil v2.
 *
 * Palier 1 (2026-10-08) : posé, utilisé par personne.
 */
export interface RepereProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  libelle: string
  /** Valeur déjà formatée (« 11 666 ») ou un nœud (compteur animé) ; null ou undefined = pas encore de donnée. */
  valeur?: React.ReactNode | null
  unite?: string
  /** Tendance ou précision : « +334 kg », « 3 non démarrées ». */
  detail?: React.ReactNode
  /** Mis en avant en argile : « 2 créances », « 6 en retard ». */
  alerte?: React.ReactNode
  /** Texte de l'état vide ; par défaut « Pas encore de donnée ». */
  vide?: string
  /** Rend le repère cliquable. */
  href?: string
}

export function Repere({ libelle, valeur, unite, detail, alerte, vide, href, className, ...props }: RepereProps) {
  const sansDonnee = valeur === null || valeur === undefined || valeur === ""
  const contenu = (
    <>
      <small className="block text-xs font-medium text-ardoise">{libelle}</small>
      {sansDonnee ? (
        <div className="mt-0.5 text-sm text-ardoise" data-vide>
          {vide ?? "Pas encore de donnée"}
        </div>
      ) : (
        <div className="mt-0.5 flex items-baseline gap-1 text-[22px] font-semibold leading-tight tracking-tight tabular-nums">
          <span>{valeur}</span>
          {unite && <span className="text-xs font-medium text-ardoise">{unite}</span>}
        </div>
      )}
      {(detail || alerte) && (
        <div className="mt-px flex flex-wrap items-center gap-x-1.5 text-xs text-ardoise">
          {detail}
          {detail && alerte && <span aria-hidden>·</span>}
          {alerte && <em className="not-italic font-semibold text-argile">{alerte}</em>}
        </div>
      )}
    </>
  )
  const classes = cn(
    "block min-w-0 rounded-xl border border-lin bg-craie px-3.5 py-2.5 text-encre",
    href && "transition-colors duration-fast hover:border-sauge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge",
    className,
  )
  if (href) {
    return (
      <Link href={href} className={classes} {...(props as React.HTMLAttributes<HTMLAnchorElement>)}>
        {contenu}
      </Link>
    )
  }
  return (
    <section className={classes} {...props}>
      {contenu}
    </section>
  )
}
