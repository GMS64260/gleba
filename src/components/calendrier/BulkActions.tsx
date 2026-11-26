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
  /** Désactive « Tout fait » (aucune tâche éligible, ex. que des soins à venir). */
  markAllDisabled?: boolean
}

export function BulkActions(props: BulkActionsProps) {
  const [open, setOpen] = React.useState(false)
  const [customOpen, setCustomOpen] = React.useState(false)
  const [customDate, setCustomDate] = React.useState("")
  // Vrai entre le choix « Date personnalisée… » et la fermeture du menu : le
  // focus doit alors aller au champ de date, pas revenir au bouton Reporter.
  const versChampDate = React.useRef(false)
  const champDate = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (customOpen && !open) champDate.current?.focus()
  }, [customOpen, open])

  if (props.count === 0) return null

  return (
    <div className="relative flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => props.onMarkAllDone()}
        disabled={props.markAllDisabled}
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
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(e) => {
              if (!versChampDate.current) return
              versChampDate.current = false
              e.preventDefault()
              champDate.current?.focus()
            }}
          >
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
                // Le menu se ferme : tant qu'il reste ouvert, Radix coupe le
                // pointeur et retient le focus hors de son calque, et le champ
                // de date, rendu à côté, ne répondait ni au clic ni au clavier
                // (D96).
                onSelect={() => {
                  versChampDate.current = true
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
        <div
          role="group"
          aria-label="Reporter à une date"
          className="absolute right-0 top-full z-50 mt-1 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-md"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation()
              setCustomOpen(false)
            }
          }}
        >
          <input
            ref={champDate}
            type="date"
            aria-label="Nouvelle date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="h-9 rounded-md border border-slate-300 px-2 text-sm"
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
