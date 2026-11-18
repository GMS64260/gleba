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

import { Button } from "@/components/ui/button"
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

/**
 * Bandeau d'échec de chargement des écrans de planification.
 *
 * Revue du 2026-11-11 — un échec n'était dit que par un toast fugitif : une
 * fois disparu, l'écran affirmait « Aucune culture prévue » ou gardait les
 * chiffres d'une autre saison. L'échec reste nommé à l'écran, avec de quoi
 * réessayer.
 */
export function ErreurChargementPlanification({
  message,
  onReessayer,
  className,
}: {
  message: string
  onReessayer: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800",
        className,
      )}
    >
      <p>{message}</p>
      <Button variant="outline" size="sm" onClick={onReessayer}>
        Réessayer
      </Button>
    </div>
  )
}
