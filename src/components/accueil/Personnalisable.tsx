"use client"

import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowsOutLineHorizontal, CaretDown, CaretLeft, CaretRight, CaretUp, DotsSixVertical, EyeSlash, Lock, Plus } from "@/lib/phosphor-icons"
import Link from "next/link"

import type { PropositionTuile } from "@/lib/accueil/disposition"
import { MODULES } from "@/lib/modules"
import { cn } from "@/lib/utils"

/**
 * Enveloppe d'un repère ou d'une tuile en mode « Personnaliser » : contour
 * pointillé, poignée de glisser-déposer (souris, doigt, clavier : espace,
 * flèches, espace), flèches Monter/Descendre, taille, et l'œil qui masque.
 * Le mouvement 6 (contours en 120 ms, réorganisation en 420 ms par FLIP)
 * est porté par les classes d'entrée et par la transition de `@dnd-kit`.
 *
 * Doit être rendue dans un `SortableContext` ; hors édition, la poignée
 * n'existe pas et le tri est désactivé.
 */
export interface PersonnalisableProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string
  libelle: string
  edition: boolean
  /** Axe des flèches : une rangée (gauche/droite) ou la grille (haut/bas). */
  axe?: "rangee" | "grille"
  premier: boolean
  dernier: boolean
  onMonter: () => void
  onDescendre: () => void
  onMasquer: () => void
  /** Cycle de taille (tuiles seulement) : libellé de la taille courante et passage à la suivante. */
  taille?: { libelle: string; onSuivante: () => void }
}

const CLASSE_POIGNEE =
  "grid h-9 w-9 place-items-center rounded-md border border-lin bg-craie text-ardoise shadow-sm hover:border-sauge hover:text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge disabled:opacity-40 disabled:hover:border-lin disabled:hover:text-ardoise"

const TRANSITION = { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" }

export function Personnalisable({
  id,
  libelle,
  edition,
  axe = "grille",
  premier,
  dernier,
  onMonter,
  onDescendre,
  onMasquer,
  taille,
  className,
  style,
  children,
  ...props
}: PersonnalisableProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !edition,
    transition: TRANSITION,
  })
  const Avant = axe === "rangee" ? CaretLeft : CaretUp
  const Apres = axe === "rangee" ? CaretRight : CaretDown
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative grid rounded-2xl",
        edition && "outline-dashed outline-[1.5px] outline-offset-[3px] outline-sauge/80 accueil-entree",
        isDragging && "z-20 rotate-[0.6deg] shadow-fiche",
        className,
      )}
      {...props}
    >
      {children}
      {edition && (
        <div className="absolute right-2 top-2 z-10 flex gap-1" role="group" aria-label={`Disposer « ${libelle} »`}>
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            className={cn(CLASSE_POIGNEE, "cursor-grab touch-none active:cursor-grabbing")}
            aria-label={`Déplacer « ${libelle} » : espace pour saisir, flèches pour déplacer, espace pour poser`}
            title="Glisser pour déplacer"
          >
            <DotsSixVertical className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={onMonter} disabled={premier} className={CLASSE_POIGNEE} aria-label={`${libelle} : ${axe === "rangee" ? "vers la gauche" : "monter"}`} title={axe === "rangee" ? "Vers la gauche" : "Monter"}>
            <Avant className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={onDescendre} disabled={dernier} className={CLASSE_POIGNEE} aria-label={`${libelle} : ${axe === "rangee" ? "vers la droite" : "descendre"}`} title={axe === "rangee" ? "Vers la droite" : "Descendre"}>
            <Apres className="h-4 w-4" aria-hidden />
          </button>
          {taille && (
            <button
              type="button"
              onClick={taille.onSuivante}
              className={cn(CLASSE_POIGNEE, "hidden w-auto gap-1 px-2 text-xs font-semibold lg:inline-flex")}
              aria-label={`Taille de « ${libelle} » : ${taille.libelle}. Passer à la taille suivante`}
              title="Changer la taille"
            >
              <ArrowsOutLineHorizontal className="h-4 w-4" aria-hidden />
              {taille.libelle}
            </button>
          )}
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

/**
 * Catalogue des tuiles en mode Personnaliser : celles qui ne sont pas sur la
 * page, à ajouter d'un geste ; celles dont le module est désactivé restent
 * proposées, grisées, avec le chemin des réglages. « Chacun construit sa
 * page en fonction de son activité » (Guillaume, 2026-10-10).
 */
export function CatalogueTuiles({
  propositions,
  onAjouter,
  className,
}: {
  propositions: PropositionTuile[]
  onAjouter: (id: PropositionTuile["fiche"]["id"]) => void
  className?: string
}) {
  const restantes = propositions.filter((p) => !p.affichee)
  return (
    <section className={cn("rounded-2xl border-[1.5px] border-dashed border-lin px-4 py-3", className)} aria-label="Ajouter une tuile">
      <div className="flex items-baseline justify-between gap-3">
        <b className="text-[13.5px] font-semibold text-encre">Ajouter une tuile</b>
        <span className="text-xs text-ardoise">
          {restantes.length === 0 ? "Tout est sur la page." : `${restantes.length} proposée${restantes.length > 1 ? "s" : ""}`}
        </span>
      </div>
      {restantes.length > 0 && (
        <ul className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {restantes.map(({ fiche, moduleManquant }) => (
            <li
              key={fiche.id}
              className={cn(
                "flex min-w-0 items-start gap-3 rounded-xl border border-lin bg-craie px-3 py-2.5",
                moduleManquant && "opacity-70",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <b className="text-[13.5px] font-semibold text-encre">{fiche.libelle}</b>
                  {fiche.module && <span className="rounded-full bg-lin-doux px-2 py-0.5 text-[11px] font-semibold text-ardoise">{MODULES[fiche.module].label}</span>}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-5 text-ardoise">{fiche.description}</p>
                {moduleManquant && (
                  <Link href="/parametres" className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-sauge hover:underline">
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                    Module {MODULES[moduleManquant].label} désactivé : l&rsquo;activer dans les réglages
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => onAjouter(fiche.id)}
                disabled={Boolean(moduleManquant)}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-lin bg-craie px-3 text-sm font-semibold text-sauge transition-colors duration-fast hover:bg-sauge-doux focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge disabled:opacity-50"
                aria-label={`Ajouter la tuile « ${fiche.libelle} »`}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Ajouter
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
