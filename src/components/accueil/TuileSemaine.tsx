import * as React from "react"
import Link from "next/link"
import { Cloud, CloudRain, CloudSun, Snowflake, Sun } from "lucide-react"

import { dateMidiLocal } from "@/lib/accueil/classement"
import { cn } from "@/lib/utils"

import { CLASSES_LIEN_DISCRET } from "./boutons"
import { Tuile } from "./Tuile"

/** Sous-ensemble de `GET /api/meteo?parcelleId=` (MeteoPrevision). */
export interface PrevisionSemaine {
  date: string
  tempMin: number
  tempMax: number
  precipitation: number
  sunshine?: number
}

export interface MeteoSemaine {
  parcelle: { id: string; nom: string }
  actuelle: { temperature: number; weatherDescription: string; humidity: number; windSpeed: number } | null
  previsions: PrevisionSemaine[]
  alertes: { type: string; niveau: "info" | "attention" | "danger"; date: string; message: string; details: string }[]
}

export interface TuileSemaineProps {
  meteo: MeteoSemaine | null
  chargement: boolean
  erreur: string | null
  rang?: number
}

const FORMAT_JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "short" })

/**
 * Icône dérivée des champs disponibles (la prévision journalière Open-Meteo
 * servie par Gleba n'a pas de code temps) ; le texte en dessous porte
 * toujours la valeur (mm, gel), jamais l'icône seule.
 */
function IconeJour({ p }: { p: PrevisionSemaine }) {
  const cls = "mx-auto h-4 w-4"
  if (p.tempMin <= 0) return <Snowflake className={cn(cls, "text-eau")} aria-hidden />
  if (p.precipitation >= 1) return <CloudRain className={cn(cls, "text-eau")} aria-hidden />
  if ((p.sunshine ?? 0) >= 6) return <Sun className={cn(cls, "text-paille")} aria-hidden />
  if ((p.sunshine ?? 0) >= 2) return <CloudSun className={cn(cls, "text-paille")} aria-hidden />
  return <Cloud className={cn(cls, "text-ardoise")} aria-hidden />
}

export function TuileSemaine({ meteo, chargement, erreur, rang }: TuileSemaineProps) {
  const jours = meteo?.previsions.slice(0, 7) ?? []
  const vide = !chargement && (!meteo || jours.length === 0)

  return (
    <Tuile
      idTuile="semaine"
      titre="Semaine"
      sousTitre={meteo ? meteo.parcelle.nom : chargement ? "lecture en cours" : undefined}
      largeur={5}
      rang={rang}
      actions={
        <Link href="/meteo" className={CLASSES_LIEN_DISCRET}>
          Météo
        </Link>
      }
      vide={vide}
      messageVide={
        erreur
          ? `Prévisions indisponibles : ${erreur}`
          : "Aucune parcelle géolocalisée : placez la ferme sur la carte pour lire la semaine."
      }
      actionVide={
        !erreur && (
          <Link href="/parcelles" className={CLASSES_LIEN_DISCRET}>
            Placer la ferme
          </Link>
        )
      }
    >
      {chargement ? (
        <div className="grid grid-cols-7 gap-1 px-3 py-3" aria-label="Chargement des prévisions">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-16 rounded-lg bg-lin-doux motion-safe:animate-pulse" />
          ))}
        </div>
      ) : (
        <ol className="grid grid-cols-7 gap-1 px-3 py-3 text-center text-xs">
          {jours.map((p, i) => {
            const gel = p.tempMin <= 0
            const pluie = p.precipitation >= 1
            return (
              <li key={p.date} className={cn("rounded-lg px-0.5 py-1.5", i === 0 && "bg-eau-doux")}>
                <span className="block text-[11px] text-ardoise">{FORMAT_JOUR.format(dateMidiLocal(p.date)).replace(".", "")}</span>
                <IconeJour p={p} />
                <b className="block text-[15px] font-semibold tabular-nums">{Math.round(p.tempMax)}°</b>
                <span className={cn("block min-h-[14px] text-[11px] font-semibold", gel ? "text-argile" : "text-eau")}>
                  {gel ? "gel" : pluie ? `${Math.round(p.precipitation)} mm` : ""}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </Tuile>
  )
}
