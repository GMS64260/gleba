"use client"

import * as React from "react"
import { CaretDown, CaretLeft, CaretRight, CaretUp, EyeSlash } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Enveloppe d'un repère ou d'une tuile en mode « Personnaliser » : contour
 * pointillé, et trois commandes au clavier comme à la souris (Monter,
 * Descendre, Masquer). Pas de glisser-déposer : aucune dépendance, et le
 * clavier est traité d'emblée. Le mouvement 6 (contours et poignées en
 * 120 ms) est porté par les classes d'entrée.
 */
export interface PersonnalisableProps extends React.HTMLAttributes<HTMLDivElement> {
  libelle: string
  edition: boolean
  /** Axe des flèches : une rangée (gauche/droite) ou la grille (haut/bas). */
  axe?: "rangee" | "grille"
  premier: boolean
  dernier: boolean
  onMonter: () => void
  onDescendre: () => void
  onMasquer: () => void
}

const CLASSE_POIGNEE =
  "grid h-9 w-9 place-items-center rounded-md border border-lin bg-craie text-ardoise shadow-sm hover:border-sauge hover:text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge disabled:opacity-40 disabled:hover:border-lin disabled:hover:text-ardoise"

export function Personnalisable({
  libelle,
  edition,
  axe = "grille",
  premier,
  dernier,
  onMonter,
  onDescendre,
  onMasquer,
  className,
  children,
  ...props
}: PersonnalisableProps) {
  const Avant = axe === "rangee" ? CaretLeft : CaretUp
  const Apres = axe === "rangee" ? CaretRight : CaretDown
  return (
    <div
      className={cn(
        "relative grid rounded-2xl",
        edition && "outline-dashed outline-[1.5px] outline-offset-[3px] outline-sauge/80 accueil-entree",
        className,
      )}
      {...props}
    >
      {children}
      {edition && (
        <div className="absolute right-2 top-2 z-10 flex gap-1" role="group" aria-label={`Disposer « ${libelle} »`}>
          <button type="button" onClick={onMonter} disabled={premier} className={CLASSE_POIGNEE} aria-label={`${libelle} : ${axe === "rangee" ? "vers la gauche" : "monter"}`} title={axe === "rangee" ? "Vers la gauche" : "Monter"}>
            <Avant className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={onDescendre} disabled={dernier} className={CLASSE_POIGNEE} aria-label={`${libelle} : ${axe === "rangee" ? "vers la droite" : "descendre"}`} title={axe === "rangee" ? "Vers la droite" : "Descendre"}>
            <Apres className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={onMasquer} className={CLASSE_POIGNEE} aria-label={`Masquer « ${libelle} »`} title="Masquer">
            <EyeSlash className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}

/** Bande des éléments masqués, avec « Remettre » pour chacun. */
export function BandeMasques({
  titre,
  elements,
  onRemettre,
  className,
}: {
  titre: string
  elements: { id: string; libelle: string }[]
  onRemettre: (id: string) => void
  className?: string
}) {
  if (elements.length === 0) return null
  return (
    <div className={cn("grid place-items-center rounded-2xl border-[1.5px] border-dashed border-lin px-3 py-3 text-center text-[12.5px] text-ardoise", className)}>
      <div>
        <b className="block font-semibold text-encre">{titre}</b>
        <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
          {elements.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onRemettre(e.id)}
              className="inline-flex min-h-9 items-center rounded-full border border-dashed border-lin px-3 text-xs font-semibold text-sauge hover:border-sauge hover:bg-sauge-doux focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"
            >
              + {e.libelle}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
