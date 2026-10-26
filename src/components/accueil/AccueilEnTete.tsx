import * as React from "react"
import Link from "next/link"

import { dateMidiLocal } from "@/lib/accueil/classement"
import type { PhraseFenetre } from "@/lib/accueil/fenetre-travail"
import { PageEntete } from "@/components/shell/PageEntete"

import { CLASSES_BOUTON, CLASSES_BOUTON_PRINCIPAL } from "./boutons"

/**
 * En-tête commun du carnet : date locale et fenêtre de travail en métadonnées,
 * avec les actions Noter, Récolte et Personnaliser.
 */
export interface AccueilEnTeteProps {
  /**
   * Jour civil local AAAA-MM-JJ ; `null` tant qu'il n'est pas connu (prérendu
   * du build et hydratation) : sa place est réservée sans calcul de date au
   * rendu serveur. Le titre Aujourd'hui reste toujours présent.
   */
  date: string | null
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
    <PageEntete id="aujourdhui" className={className} description={<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="min-h-6 font-medium text-encre">
          {date ? (
            <time dateTime={date}>{libelleDate(date)}</time>
          ) : (
            <>
              {/* L'espace garde la hauteur de la ligne, le texte masqu\u00e9 donne un nom au titre. */}
              <span aria-hidden>{"\u00a0"}</span>
            </>
          )}
        </span>
        <span aria-hidden>·</span>
        <span aria-live="polite">
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
        </span>
      </div>} actions={<>
        <Link href="/taches" className={CLASSES_BOUTON}>
          Noter
        </Link>
        <Link href="/maraichage/recoltes" className={CLASSES_BOUTON_PRINCIPAL}>
          + Récolte
        </Link>
        {actions}
      </>} />
  )
}
