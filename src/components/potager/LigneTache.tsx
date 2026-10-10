"use client"

/**
 * Lignes de geste des listes du jour (tâches de culture, arrosages
 * planifiés) : la ligne de registre de la charte, avec l'état en verbe et
 * une seule action. Remplace les boutons-lignes à fond rouge et les badges
 * « N sem. de retard » de la page Tâches et de l'onglet Calendrier
 * (P4 « une liste est un registre », 2026-10-09).
 *
 * Import direct des deux composants (pas l'index `@/components/accueil`,
 * qui entraînerait tout l'accueil dans le bundle des modules).
 */
import * as React from "react"
import { CalendarClock } from "lucide-react"

import { LigneRegistre } from "@/components/accueil/LigneRegistre"
import { PastilleEtat } from "@/components/accueil/PastilleEtat"
import {
  etatArrosage,
  etatTache,
  libelleActionTache,
  libelleRetard,
  type TypeTache,
} from "@/lib/accueil/etat-tache"

/** Une variété « Non spécifiée » n'est pas une information : même règle que l'accueil. */
export function varieteAffichable(nom: string | null | undefined): string {
  if (!nom) return ""
  return /non sp[ée]cifi/i.test(nom) ? "" : nom
}

/** Nom d'espèce précédé de sa couleur de plan ; barré quand c'est fait. */
export function TitreEspece({ nom, couleur, barre }: { nom: string; couleur?: string | null; barre?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      {couleur && <i aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: couleur }} />}
      <span className={barre ? "min-w-0 truncate text-ardoise line-through" : "min-w-0 truncate"}>{nom}</span>
    </span>
  )
}

const CLASSES_SECONDAIRE =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ardoise transition-colors duration-fast hover:bg-lin-doux hover:text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"

export interface LigneTacheProps {
  type: TypeTache
  especeNom: string
  varieteNom?: string | null
  plancheNom?: string | null
  couleur?: string | null
  /** Date prévue (ISO) ; affichée en jj/mm. */
  date?: string | null
  fait: boolean
  retardJours?: number | null
  /** Solde la ligne (« Fait »), ouvre la saisie (« Noter ») ou revient en arrière (« Annuler »). */
  onAction: () => void
  /** Déplace l'échéance ; absent quand la ligne est faite. */
  onReporter?: () => void
  disabled?: boolean
}

export function LigneTache({
  type,
  especeNom,
  varieteNom,
  plancheNom,
  couleur,
  date,
  fait,
  retardJours,
  onAction,
  onReporter,
  disabled,
}: LigneTacheProps) {
  const { etat, libelle } = etatTache({ type, fait, retardJours })
  const datePrevue = date ? new Date(date) : null
  const dateLisible =
    datePrevue && !Number.isNaN(datePrevue.getTime())
      ? `Prévu le ${datePrevue.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`
      : ""
  return (
    <LigneRegistre
      etat={etat}
      titre={<TitreEspece nom={especeNom} couleur={couleur} barre={fait} />}
      meta={[varieteAffichable(varieteNom), plancheNom ?? "", dateLisible, fait ? "" : libelleRetard(retardJours ?? 0)]}
      pastille={<PastilleEtat etat={etat} libelle={libelle} className="hidden sm:inline-flex" />}
      secondaire={
        !fait && onReporter ? (
          <button
            type="button"
            className={CLASSES_SECONDAIRE}
            aria-label="Reporter cette échéance"
            title="Reporter cette échéance"
            onClick={onReporter}
            disabled={disabled}
          >
            <CalendarClock className="h-4 w-4" aria-hidden />
          </button>
        ) : undefined
      }
      action={{ libelle: libelleActionTache(type, fait), onClick: onAction, disabled }}
    />
  )
}

export interface LigneArrosageProps {
  /** La planche d'abord ; à défaut les espèces. */
  titre: string
  /** Métadonnées (espèces, nombre de cultures, raison du bilan hydrique). */
  details?: Array<string | null | undefined>
  /** Urgence du bilan hydrique (`src/lib/irrigation/a-arroser.ts`). */
  urgence: "critique" | "haute"
  fait?: boolean
  onAction: () => void
  disabled?: boolean
}

/** Une planche à arroser aujourd'hui : on la note arrosée, d'un geste. */
export function LigneArrosage({ titre, details, urgence, fait = false, onAction, disabled }: LigneArrosageProps) {
  const { etat, libelle } = etatArrosage(urgence, fait)
  return (
    <LigneRegistre
      etat={etat}
      titre={<TitreEspece nom={titre} barre={fait} />}
      meta={(details ?? []).map((d) => d ?? "")}
      pastille={<PastilleEtat etat={etat} libelle={libelle} className="hidden sm:inline-flex" />}
      action={{ libelle: "Noter", onClick: onAction, disabled: disabled || fait }}
    />
  )
}
