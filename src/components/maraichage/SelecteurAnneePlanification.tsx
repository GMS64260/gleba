"use client"

/**
 * Sélecteur de saison du hub Planification maraîchère — un seul contrôle pour
 * les neuf écrans qui partagent `useAnneePlanification`.
 *
 * QA 2026-09-28 (« Impossible de sélectionner 2027 », Créer les cultures) :
 * chaque écran recopiait le même Select Radix. Même famille que les cinq
 * tickets du matin (voir SelectNatif) : un remplissage qui n'atteint pas
 * `onValueChange` laisse la saison inchangée. Un <select> natif, et un seul
 * endroit à corriger.
 */

import * as React from "react"

import { SelectNatif } from "@/components/ui/select-natif"
import { cn } from "@/lib/utils"

interface SelecteurAnneePlanificationProps {
  annee: number
  annees: readonly number[]
  onChange: (annee: number) => void
  className?: string
}

export function SelecteurAnneePlanification({ annee, annees, onChange, className }: SelecteurAnneePlanificationProps) {
  return (
    <SelectNatif
      aria-label="Saison"
      title="Saison"
      className={cn("w-[100px]", className)}
      value={String(annee)}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
    >
      {annees.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </SelectNatif>
  )
}
