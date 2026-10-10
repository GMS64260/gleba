import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Tuile de l'accueil bento : en-tête (titre, sous-titre, actions), corps, et
 * un état vide obligatoire quand la tuile n'a rien à montrer. Fond blanc,
 * bordure lin, pas d'ombre (elle n'est pas superposée).
 *
 * Palier 1 (2026-10-08) : posée, utilisée par personne. La largeur et la
 * hauteur en colonnes servent à TuileGrille (12 colonnes sur grand écran, une
 * seule sur mobile).
 */
export type LargeurTuile = 4 | 5 | 6 | 7 | 8 | 12
export type HauteurTuile = 1 | 2

export interface TuileProps extends React.HTMLAttributes<HTMLElement> {
  titre: React.ReactNode
  sousTitre?: React.ReactNode
  /** Actions de l'en-tête (lien « Tout voir », bouton). */
  actions?: React.ReactNode
  largeur?: LargeurTuile
  hauteur?: HauteurTuile
  /** Identifiant stable de la tuile (préférence de disposition, L3). */
  idTuile?: string
  /** Si vrai, le corps est remplacé par l'état vide. */
  vide?: boolean
  /** Message de l'état vide, voix de terrain : « Aucun soin prévu aujourd'hui ». */
  messageVide?: React.ReactNode
  actionVide?: React.ReactNode
  /** Rang d'apparition pour le mouvement d'entrée (40 ms par rang). */
  rang?: number
}

/** Classes littérales (Tailwind ne génère pas les classes construites). */
export const CLASSES_LARGEUR: Record<LargeurTuile, string> = {
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
}

const HAUTEURS: Record<HauteurTuile, string> = {
  1: "",
  2: "lg:row-span-2",
}

export function TuileVide({ message, action }: { message?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div data-vide className="flex flex-col items-start gap-2 px-4 py-6 text-sm text-ardoise">
      <p>{message ?? "Rien à signaler pour le moment."}</p>
      {action}
    </div>
  )
}

export function Tuile({
  titre,
  sousTitre,
  actions,
  largeur = 12,
  hauteur = 1,
  idTuile,
  vide = false,
  messageVide,
  actionVide,
  rang,
  className,
  children,
  style,
  ...props
}: TuileProps) {
  return (
    <section
      data-tuile={idTuile}
      className={cn(
        "col-span-1 flex min-w-0 flex-col rounded-2xl border border-lin bg-craie text-encre",
        CLASSES_LARGEUR[largeur],
        HAUTEURS[hauteur],
        rang !== undefined && "accueil-entree",
        className,
      )}
      style={rang !== undefined ? ({ ...style, "--rang": rang } as React.CSSProperties) : style}
      {...props}
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-lin px-4 pb-2.5 pt-3.5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight">{titre}</h3>
          {sousTitre && <p className="mt-0.5 text-xs text-ardoise">{sousTitre}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 text-xs">{actions}</div>}
      </header>
      {vide ? <TuileVide message={messageVide} action={actionVide} /> : <div className="min-h-0 flex-1">{children}</div>}
    </section>
  )
}
