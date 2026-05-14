"use client"

/**
 * Boutons d'action en masse pour les calendriers (PROMPT 20a).
 *
 * - "Tout fait aujourd'hui" : marque comme fait toutes les tâches en retard
 *   ou prévues pour aujourd'hui sur la section.
 * - "Reporter" : décale la datePrevue de +1j, +3j, +1sem, ou date custom.
 *
 * Le composant est piloté par 2 callbacks : `onMarkAllDone` et `onReport`.
 * Aux appelants de réaliser l'appel API + optimistic update.
 */

import * as React from "react"
import { CheckCheck, CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface BulkActionsProps {
  /** Nb de tâches sélectionnables (ne pas afficher si 0). */
  count: number
  /** Marque toutes les tâches éligibles comme faites. */
  onMarkAllDone: () => void | Promise<void>
  /** Reporter de N jours (positif uniquement). */
  onReport?: (days: number) => void | Promise<void>
  /** Reporter à une date absolue. */
  onReportTo?: (date: string) => void | Promise<void>
  /** Si false, masque le bouton Reporter (sections sans datePrevue). */
  reportEnabled?: boolean
  /** Label personnalisé du bouton "Tout fait". */
  markAllLabel?: string
}

export function BulkActions(props: BulkActionsProps) {
  const [open, setOpen] = React.useState(false)
  const [customOpen, setCustomOpen] = React.useState(false)
  const [customDate, setCustomDate] = React.useState("")

  if (props.count === 0) return null

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => props.onMarkAllDone()}
        title="Marque toutes les tâches non faites de la section"
      >
        <CheckCheck className="h-3.5 w-3.5 mr-1" />
        {props.markAllLabel || `Tout fait (${props.count})`}
      </Button>

      {props.reportEnabled !== false && (props.onReport || props.onReportTo) && (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarClock className="h-3.5 w-3.5 mr-1" />
              Reporter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {props.onReport && (
              <>
                <DropdownMenuItem onSelect={() => props.onReport!(1)}>+ 1 jour</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => props.onReport!(3)}>+ 3 jours</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => props.onReport!(7)}>+ 1 semaine</DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {props.onReportTo && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setCustomOpen(true)
                }}
              >
                Date personnalisée…
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {customOpen && (
        <div className="absolute z-50 mt-10 bg-white border border-slate-200 rounded-md shadow-md p-3 flex items-center gap-2">
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="h-9 rounded-md border border-slate-300 px-2 text-sm"
            autoFocus
          />
          <Button
            size="sm"
            disabled={!customDate}
            onClick={() => {
              if (customDate && props.onReportTo) {
                props.onReportTo(customDate)
                setCustomOpen(false)
                setCustomDate("")
              }
            }}
          >
            OK
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCustomOpen(false)}>
            Annuler
          </Button>
        </div>
      )}
    </div>
  )
}
