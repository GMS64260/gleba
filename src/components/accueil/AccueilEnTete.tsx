import * as React from "react"
import Link from "next/link"

import { dateMidiLocal } from "@/lib/accueil/classement"
import type { PhraseFenetre } from "@/lib/accueil/fenetre-travail"
import { cn } from "@/lib/utils"

import { CLASSES_BOUTON, CLASSES_BOUTON_PRINCIPAL } from "./boutons"

/**
 * En-tête de l'accueil v2 : la date en Fraunces, la fenêtre de travail en une
 * ligne, deux actions (Noter, + Récolte). Le bouton « Personnaliser » arrive
 * avec la livraison L3.
 */
export interface AccueilEnTeteProps {
  /** Jour civil local AAAA-MM-JJ. */
  date: string
  fenetre: PhraseFenetre | null
  /** Météo en cours de lecture : la ligne reste réservée, sans texte inventé. */
  chargementFenetre?: boolean
  /** Température actuelle, en tête de la ligne sur téléphone (le bandeau météo n'y est pas). */
  temperature?: number | null
  /** Actions supplémentaires à droite (bouton Personnaliser). */
  actions?: React.ReactNode
  className?: string
}

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" })

export function libelleDate(dateIso: string): string {
  const texte = FORMAT_DATE.format(dateMidiLocal(dateIso))
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

export function AccueilEnTete({ date, fenetre, chargementFenetre = false, temperature, actions, className }: AccueilEnTeteProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-medium leading-tight tracking-tight text-encre sm:text-[34px]">
          {libelleDate(date)}
        </h1>
        <p className="mt-1 text-sm text-ardoise" aria-live="polite">
          {typeof temperature === "number" && (
            <span className="font-semibold text-encre lg:hidden">
              {Math.round(temperature)} °C<span aria-hidden> · </span>
            </span>
          )}
          {fenetre ? (
            <>
              Fenêtre de travail : <b className="font-semibold text-prairie">{fenetre.principal}</b>
              {fenetre.details.map((d) => (
                <React.Fragment key={d}>
                  <span aria-hidden> · </span>
                  {d}
                </React.Fragment>
              ))}
            </>
          ) : chargementFenetre ? (
            <span className="text-ardoise/70">Fenêtre de travail : lecture de la météo…</span>
          ) : (
            <span>Fenêtre de travail : indisponible sans parcelle géolocalisée.</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href="/taches" className={CLASSES_BOUTON}>
          Noter
        </Link>
        <Link href="/maraichage/recoltes" className={CLASSES_BOUTON_PRINCIPAL}>
          + Récolte
        </Link>
        {actions}
      </div>
    </div>
  )
}
