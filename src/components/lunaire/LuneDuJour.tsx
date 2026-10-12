"use client"

import * as React from "react"
import Link from "next/link"

import { todayLocalISO } from "@/lib/format-utils"
import { cn } from "@/lib/utils"

import { LuneSvg } from "./LuneSvg"
import { LIEN_CALENDRIER_LUNAIRE, configTypeJour, estCroissante, lireJourLunaire, type JourLunaire } from "./lecture"

/**
 * Petite lune de l'accueil v2, à côté du résumé météo : la phase du jour
 * dessinée, le nom de la phase et le type de jour, et le lien vers le
 * calendrier complet de la page Météo. Sous `lg`, le disque seul (demande de
 * Guillaume du 2026-10-12 : « une petite lune à côté de la météo »).
 */
export function LuneDuJour({ className }: { className?: string }) {
  const [jour, setJour] = React.useState<JourLunaire | null>(null)

  React.useEffect(() => {
    let annule = false
    lireJourLunaire(todayLocalISO()).then((j) => {
      if (!annule) setJour(j)
    })
    return () => {
      annule = true
    }
  }, [])

  if (!jour) return null
  const type = configTypeJour(jour.typeJour)
  const resume = `${jour.phase}, ${jour.illumination} % éclairée, jour ${type.label.toLowerCase()}`
  return (
    <Link
      href={LIEN_CALENDRIER_LUNAIRE}
      title={`Calendrier lunaire : ${resume}`}
      aria-label={`Calendrier lunaire : ${resume}`}
      className={cn("flex shrink-0 items-center gap-2.5 text-sm text-encre hover:underline underline-offset-2", className)}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lin-doux" aria-hidden>
        <LuneSvg illumination={jour.illumination} croissante={estCroissante(jour)} className="h-5 w-5" />
      </span>
      <span className="hidden leading-tight lg:inline" aria-hidden>
        <b className="font-semibold">{jour.phase}</b>
        <br />
        <span className="text-ardoise">
          Jour {type.label.toLowerCase()} · {jour.illumination} %
        </span>
      </span>
    </Link>
  )
}
