"use client"

import * as React from "react"
import Link from "next/link"

import type { ElementAujourdhui } from "@/lib/accueil/types"
import { sousTitreAujourdhui } from "@/lib/accueil/classement"

import { CLASSES_LIEN_DISCRET } from "./boutons"
import { LigneRegistre } from "./LigneRegistre"
import { PastilleEtat } from "./PastilleEtat"
import { Tuile, TuileVide } from "./Tuile"

/** Lignes visibles avant « Voir les N autres ». */
export const LIGNES_VISIBLES = 8

export interface TuileAujourdhuiProps {
  elements: ElementAujourdhui[]
  /** Sources qui n'ont pas pu être lues : un état vide ne peut pas être affirmé. */
  sourcesEnErreur: string[]
  chargement: boolean
  erreur: string | null
  onReessayer?: () => void
  rang?: number
}

function pastillePour(e: ElementAujourdhui): React.ReactNode {
  if (e.etat === "critique") return <PastilleEtat etat="critique" libelle="Urgent" className="hidden sm:inline-flex" />
  if (e.etat === "attention") {
    return (
      <PastilleEtat etat="attention" libelle={e.retardJours > 0 ? "En retard" : "À faire"} className="hidden sm:inline-flex" />
    )
  }
  return null
}

export function TuileAujourdhui({ elements, sourcesEnErreur, chargement, erreur, onReessayer, rang }: TuileAujourdhuiProps) {
  const [toutVoir, setToutVoir] = React.useState(false)
  const visibles = toutVoir ? elements : elements.slice(0, LIGNES_VISIBLES)
  const reste = elements.length - visibles.length

  let corps: React.ReactNode
  if (chargement) {
    corps = (
      <ul className="divide-y divide-lin-doux" aria-label="Chargement de la liste du jour">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex items-center gap-3 px-3 py-3">
            <span className="h-9 w-1 rounded-sm bg-lin" />
            <span className="h-4 w-2/3 rounded bg-lin-doux motion-safe:animate-pulse" />
          </li>
        ))}
      </ul>
    )
  } else if (erreur) {
    corps = (
      <TuileVide
        message={`Impossible de lire la liste du jour : ${erreur}`}
        action={
          onReessayer && (
            <button type="button" onClick={onReessayer} className={CLASSES_LIEN_DISCRET}>
              Réessayer
            </button>
          )
        }
      />
    )
  } else if (elements.length === 0) {
    corps =
      sourcesEnErreur.length > 0 ? (
        <TuileVide
          message={`Rien à signaler dans ce qui a pu être lu. Sources indisponibles : ${sourcesEnErreur.join(", ")}.`}
          action={
            onReessayer && (
              <button type="button" onClick={onReessayer} className={CLASSES_LIEN_DISCRET}>
                Réessayer
              </button>
            )
          }
        />
      ) : (
        <TuileVide
          message="Rien d'urgent aujourd'hui. Le calendrier garde le détail de la semaine."
          action={
            <Link href="/taches" className={CLASSES_LIEN_DISCRET}>
              Ouvrir le calendrier
            </Link>
          }
        />
      )
  } else {
    corps = (
      <>
        <div role="list">
          {visibles.map((e) => (
            <LigneRegistre
              key={e.id}
              role="listitem"
              etat={e.etat}
              titre={e.titre}
              meta={e.meta}
              pastille={pastillePour(e)}
              action={{ libelle: e.action.libelle, href: e.action.href }}
            />
          ))}
        </div>
        {reste > 0 && (
          <div className="border-t border-lin-doux px-3 py-1">
            <button type="button" onClick={() => setToutVoir(true)} className={CLASSES_LIEN_DISCRET}>
              Voir {reste === 1 ? "la dernière" : `les ${reste} autres`}
            </button>
          </div>
        )}
        {sourcesEnErreur.length > 0 && (
          <p className="border-t border-lin-doux px-4 py-2 text-xs text-ardoise">
            Non lu aujourd&rsquo;hui : {sourcesEnErreur.join(", ")}.
          </p>
        )}
      </>
    )
  }

  return (
    <Tuile
      idTuile="aujourdhui"
      titre="Aujourd'hui"
      sousTitre={chargement ? "lecture en cours" : erreur ? "indisponible" : sousTitreAujourdhui(elements.length)}
      largeur={7}
      hauteur={2}
      rang={rang}
    >
      {corps}
    </Tuile>
  )
}
