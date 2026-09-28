"use client"

/**
 * Période d'une liste de gestion : l'exercice du module, ou toutes les années.
 *
 * Signalement 2026-09-27 (soins) puis revue du 2026-09-28 (ventes, abattages,
 * consommations) : ces listes ne demandaient à l'API que l'année civile
 * courante, sans sélecteur — un historique ressaisi y était invisible et donc
 * impossible à corriger. Un seul contrôle (natif, cf. SelectNatif) pour toutes.
 */

import * as React from "react"

import { SelectNatif } from "@/components/ui/select-natif"

export type PeriodeListe = "exercice" | "toutes"

/** Paramètre d'URL correspondant, pour une route qui lit `lireAnnee()`. */
export function parametreAnnee(periode: PeriodeListe, annee: number): string {
  return periode === "toutes" ? "annee=all" : `annee=${annee}`
}

export function SelecteurPeriodeExercice({
  annee,
  periode,
  onChange,
  libelle = "Période affichée",
  className,
}: {
  annee: number
  periode: PeriodeListe
  onChange: (periode: PeriodeListe) => void
  libelle?: string
  className?: string
}) {
  return (
    <SelectNatif
      aria-label={libelle}
      title={libelle}
      className={className ?? "w-[180px]"}
      value={periode}
      onChange={(e) => onChange(e.target.value === "toutes" ? "toutes" : "exercice")}
    >
      <option value="exercice">Exercice {annee}</option>
      <option value="toutes">Toutes les années</option>
    </SelectNatif>
  )
}
