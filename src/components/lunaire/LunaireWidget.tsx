"use client"

/**
 * Widget lunaire compact de l'en-tête historique (pages maraîchage et verger,
 * `AppHeader showLune`). Pattern identique à HeaderMeteoWidget : bouton
 * responsive + Popover. Le contenu est le `CalendrierLunaire` partagé avec la
 * page Météo ; l'accueil v2 n'a qu'une petite lune (`LuneDuJour`, 2026-10-12).
 */

import * as React from "react"
import { ChevronDown, Loader2 } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { todayLocalISO } from "@/lib/format-utils"

import { CalendrierLunaire } from "./CalendrierLunaire"
import { LuneSvg } from "./LuneSvg"
import { estCroissante, lireJourLunaire, type JourLunaire } from "./lecture"

export interface LunaireWidgetProps {
  /** Dans le bandeau météo de l'en-tête historique : sans bordure, pleine hauteur. */
  embedded?: boolean
}

export function LunaireWidget({ embedded = false }: LunaireWidgetProps) {
  const [today, setToday] = React.useState<JourLunaire | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    let annule = false
    lireJourLunaire(todayLocalISO()).then((jour) => {
      if (annule) return
      setToday(jour)
      setLoading(false)
    })
    return () => {
      annule = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center px-2 py-1 text-ardoise/60" aria-label="Calendrier lunaire" aria-busy="true">
        <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />
      </div>
    )
  }

  if (!today) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`group flex items-center justify-center gap-1.5 px-2 transition-colors sm:px-3 ${
            embedded ? "h-full bg-papier hover:bg-lin-doux" : "min-h-11 rounded-xl border border-lin bg-craie py-1.5 hover:border-sauge sm:py-2"
          }`}
          aria-label={`Calendrier lunaire : ${today.phase}`}
          title={`${today.phase}, ${today.illumination} % éclairée`}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <LuneSvg illumination={today.illumination} croissante={estCroissante(today)} className="h-5 w-5" />
          <ChevronDown className="h-3 w-3 text-ardoise group-hover:text-encre" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,calc(100vw-1rem))] p-0" side="bottom" align="end" sideOffset={8}>
        <CalendrierLunaire variante="popover" />
      </PopoverContent>
    </Popover>
  )
}
