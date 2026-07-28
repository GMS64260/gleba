"use client"

/**
 * Contexte de filière sélectionnée en tête du module Élevage.
 *
 * Le sélecteur (page /elevage) choisit "toutes" ou une filière précise ; tout
 * le module (listes, onglets, dashboard) s'y adapte en lisant ce contexte.
 * cf. docs/elevage-modes-phase0-spec.md
 */

import * as React from "react"
import type { Filiere } from "@/lib/elevage/filiere"
import { capacites, type CapacitesFiliere } from "@/lib/elevage/filiere-ui"

export type FiliereSelection = "toutes" | Filiere

const FiliereContext = React.createContext<FiliereSelection>("toutes")

export function FiliereProvider({
  value,
  children,
}: {
  value: FiliereSelection
  children: React.ReactNode
}) {
  return <FiliereContext.Provider value={value}>{children}</FiliereContext.Provider>
}

/** Filière sélectionnée en tête du module ("toutes" = pas de filtrage). */
export function useFiliereSelection(): FiliereSelection {
  return React.useContext(FiliereContext)
}

/** Vrai si une entité de cette filière doit être visible pour la sélection courante. */
export function filiereMatch(selection: FiliereSelection, filiere: string | null | undefined): boolean {
  if (selection === "toutes") return true
  return (filiere || "rente") === selection
}

/**
 * Capacités d'UI pour la sélection d'atelier courante. "toutes" retombe sur le
 * profil rente (on montre tout, car des animaux de rente peuvent être présents) ;
 * une filière précise applique ses propres capacités (masquage des surfaces de rente).
 */
export function capacitesSelection(selection: FiliereSelection): CapacitesFiliere {
  return capacites(selection === "toutes" ? "rente" : selection)
}
