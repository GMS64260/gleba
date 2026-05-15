"use client"

/**
 * QA Camille 2026-05-15 — Bonus : sélecteur d'année factorisé.
 *
 * Avant : chaque page (page.tsx, elevage, verger, compta, interventions,
 * tracabilite, couts-production) hardcodait sa plage d'années avec des
 * formules subtilement divergentes (length 5 vs 6, ±1). Conséquences :
 *   * Maraîchage : 2021–2026
 *   * Compta    : 2022–2026
 *   * Aucun module ne proposait 2027 (planification anticipée bloquée)
 *
 * Source unique : `getAvailableYears()` retourne
 *   [currentYear + 1, currentYear, …, currentYear - 4]
 * → 6 années dont la suivante, ordre décroissant pour le Select.
 *
 * Si tu dois élargir la plage (utilisateur historique avant 5 ans), ajoute
 * un prop `earliest` à <YearSelector earliest={2018} />.
 */

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "lucide-react"

const CURRENT_YEAR = new Date().getFullYear()
const DEFAULT_LOOKBACK = 4 // 4 ans en arrière → plage de 6 années (N-4 .. N+1)

export function getAvailableYears(earliest?: number): number[] {
  const oldest = earliest ?? CURRENT_YEAR - DEFAULT_LOOKBACK
  const years: number[] = []
  for (let y = CURRENT_YEAR + 1; y >= oldest; y--) {
    years.push(y)
  }
  return years
}

interface YearSelectorProps {
  value: number
  onChange: (year: number) => void
  earliest?: number
  className?: string
  /** Tailwind width override pour le trigger. Défaut : w-[100px]. */
  triggerClassName?: string
  /** Cache l'icône calendrier (header dense). */
  hideIcon?: boolean
}

export function YearSelector({
  value,
  onChange,
  earliest,
  triggerClassName,
  hideIcon,
}: YearSelectorProps) {
  const years = React.useMemo(() => getAvailableYears(earliest), [earliest])

  return (
    <Select
      value={value.toString()}
      onValueChange={(v) => onChange(parseInt(v, 10))}
    >
      <SelectTrigger className={triggerClassName ?? "w-[100px] h-8"}>
        {!hideIcon && <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={y.toString()}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
