"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Loader2, Moon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { todayLocalISO } from "@/lib/format-utils"
import { cn } from "@/lib/utils"

import { LuneSvg } from "./LuneSvg"
import { ANCRE_CALENDRIER_LUNAIRE, TYPE_JOUR_CFG, configTypeJour, estCroissante, libelleSensDuJour, lireJourLunaire, type JourLunaire } from "./lecture"

/**
 * Calendrier lunaire : la Lune du jour (phase, type de jour, conseils) et le
 * mois, jour par jour. Deux habillages pour un seul composant : le popover de
 * l'en-tête historique (`LunaireWidget`) et la carte de la page Météo, où il
 * vit en entier depuis le 2026-10-12 (l'accueil n'en montre qu'une petite lune).
 */
interface CalendrierData {
  calendrier: { year: number; month: number; jours: JourLunaire[] }
  stats: Record<string, number>
}

const MOIS_COURTS = ["", "Janv.", "Fév.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."]
const JOURS_SEM = ["L", "M", "M", "J", "V", "S", "D"]
const FORMAT_MOIS = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" })
const FORMAT_JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" })

function libelleMois(annee: number, mois: number, long: boolean): string {
  if (!long) return `${MOIS_COURTS[mois]} ${annee}`
  const texte = FORMAT_MOIS.format(new Date(annee, mois - 1, 1))
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

export interface CalendrierLunaireProps {
  /** `popover` : contenu compact de l'en-tête historique ; `page` : carte de la page Météo. */
  variante: "popover" | "page"
  className?: string
}

export function CalendrierLunaire({ variante, className }: CalendrierLunaireProps) {
  const page = variante === "page"
  const [aujourdhui, setAujourdhui] = React.useState<JourLunaire | null>(null)
  const [jourLu, setJourLu] = React.useState(false)
  const [todayStr, setTodayStr] = React.useState<string | null>(null)
  const [mois, setMois] = React.useState<{ annee: number; mois: number } | null>(null)
  const [calData, setCalData] = React.useState<CalendrierData | null>(null)
  const [calLoading, setCalLoading] = React.useState(true)
  const [selectedDay, setSelectedDay] = React.useState<JourLunaire | null>(null)
  const requete = React.useRef(0)
  const section = React.useRef<HTMLElement>(null)

  const fetchCalendar = React.useCallback((annee: number, m: number) => {
    const numero = ++requete.current
    setCalLoading(true)
    setSelectedDay(null)
    fetch(`/api/lunaire?year=${annee}&month=${m}`)
      .then((r) => r.json())
      .then((json) => {
        if (numero === requete.current) setCalData(json)
      })
      .catch(() => {
        if (numero === requete.current) setCalData(null)
      })
      .finally(() => {
        if (numero === requete.current) setCalLoading(false)
      })
  }, [])

  // Jour et mois LOCAUX, lus après le montage : le HTML serveur (fuseau du
  // conteneur) doit rester identique au premier rendu client (React #418), et
  // entre minuit et 2 h « aujourd'hui » n'est pas le jour UTC (audit fuseaux #78).
  React.useEffect(() => {
    const jour = todayLocalISO()
    const now = new Date()
    setTodayStr(jour)
    setMois({ annee: now.getFullYear(), mois: now.getMonth() + 1 })
    fetchCalendar(now.getFullYear(), now.getMonth() + 1)
    let annule = false
    lireJourLunaire(jour).then((j) => {
      if (annule) return
      setAujourdhui(j)
      setJourLu(true)
    })
    return () => {
      annule = true
    }
  }, [fetchCalendar])

  // La palette et la tuile Raccourcis mènent à `/meteo#calendrier-lunaire`.
  React.useEffect(() => {
    if (page && window.location.hash === `#${ANCRE_CALENDRIER_LUNAIRE}`) {
      section.current?.scrollIntoView({ block: "start" })
    }
  }, [page])

  const navMonth = (delta: number) => {
    if (!mois) return
    let m = mois.mois + delta
    let annee = mois.annee
    if (m < 1) {
      m = 12
      annee--
    }
    if (m > 12) {
      m = 1
      annee++
    }
    setMois({ annee, mois: m })
    fetchCalendar(annee, m)
  }

  const offset = mois ? (() => {
    const premier = new Date(mois.annee, mois.mois - 1, 1).getDay()
    return premier === 0 ? 6 : premier - 1
  })() : 0

  const blocAujourdhui = aujourdhui ? (
    (() => {
      const tc = configTypeJour(aujourdhui.typeJour)
      const croissante = estCroissante(aujourdhui)
      return page ? (
        <>
          <div className="mt-4 flex items-center gap-4">
            <LuneSvg illumination={aujourdhui.illumination} croissante={croissante} className="h-14 w-14 shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-xl font-medium leading-tight text-encre">{aujourdhui.phase}</p>
              <p className="mt-1 text-sm text-ardoise">
                {libelleSensDuJour(aujourdhui)}, {aujourdhui.illumination} % éclairée · {Math.max(1, Math.round(aujourdhui.age))}
                <sup>e</sup> jour de la lunaison
              </p>
            </div>
          </div>
          <div className={cn("mt-4 rounded-lg p-3", tc.bg)}>
            <p className={cn("text-sm font-semibold", tc.text)}>
              {tc.emoji} Jour {tc.label.toLowerCase()}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{aujourdhui.conseil}</p>
          </div>
          {aujourdhui.conseilVerger && <p className="mt-3 text-sm leading-relaxed text-slate-600">🌳 {aujourdhui.conseilVerger}</p>}
        </>
      ) : (
        <div className="border-b p-3">
          <div className="mb-2 flex items-center gap-2">
            <LuneSvg illumination={aujourdhui.illumination} croissante={croissante} className="h-7 w-7 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{aujourdhui.phase}</p>
              <p className="text-xs text-slate-500">{aujourdhui.illumination}% illumination</p>
            </div>
          </div>
          <div className={cn("rounded-md p-2", tc.bg)}>
            <p className={cn("text-sm font-medium", tc.text)}>
              {tc.emoji} Jour {tc.label}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{aujourdhui.conseil}</p>
          </div>
          {aujourdhui.conseilVerger && <p className="mt-1.5 text-xs leading-relaxed text-slate-600">🌳 {aujourdhui.conseilVerger}</p>}
        </div>
      )
    })()
  ) : (
    <div className={cn("flex items-center gap-2 text-ardoise", page ? "mt-4 text-sm" : "border-b p-3 text-xs")} aria-busy={!jourLu}>
      {jourLu ? "Lune du jour indisponible." : (
        <>
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
          Lecture de la Lune du jour…
        </>
      )}
    </div>
  )

  const grille = (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className={cn("flex items-center gap-1 font-medium text-slate-700", page ? "text-sm" : "text-xs")}>
          {!page && <Moon className="h-3.5 w-3.5" aria-hidden />}
          {page ? "Le mois" : "Calendrier"}
        </span>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => navMonth(-1)} disabled={!mois} className={cn("rounded hover:bg-slate-100", page ? "p-1" : "p-0.5")} aria-label="Mois précédent">
            <ChevronLeft className={cn("text-slate-500", page ? "h-4 w-4" : "h-3.5 w-3.5")} aria-hidden />
          </button>
          <span className={cn("text-center font-medium text-slate-600", page ? "min-w-[130px] text-sm" : "min-w-[70px] text-[11px]")} aria-live="polite">
            {mois ? libelleMois(mois.annee, mois.mois, page) : "…"}
          </span>
          <button type="button" onClick={() => navMonth(1)} disabled={!mois} className={cn("rounded hover:bg-slate-100", page ? "p-1" : "p-0.5")} aria-label="Mois suivant">
            <ChevronRight className={cn("text-slate-500", page ? "h-4 w-4" : "h-3.5 w-3.5")} aria-hidden />
          </button>
        </div>
      </div>

      {calLoading ? (
        <div className={cn("flex items-center justify-center text-slate-400", page ? "py-16" : "py-6")} aria-busy="true">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
        </div>
      ) : calData ? (
        <>
          <div className={cn("grid grid-cols-7", page ? "gap-1" : "gap-px")}>
            {JOURS_SEM.map((j, i) => (
              <div key={i} className={cn("py-0.5 text-center font-medium text-slate-400", page ? "text-[11px]" : "text-[9px]")} aria-hidden>
                {j}
              </div>
            ))}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {calData.calendrier.jours.map((jour) => {
              const d = parseInt(jour.date.split("-")[2])
              const cfg = configTypeJour(jour.typeJour)
              const isTdy = jour.date === todayStr
              const isSel = selectedDay?.date === jour.date
              return (
                <button
                  key={jour.date}
                  type="button"
                  onClick={() => setSelectedDay(isSel ? null : jour)}
                  aria-pressed={isSel}
                  aria-current={isTdy ? "date" : undefined}
                  aria-label={`${d} : ${jour.phase}, jour ${cfg.label.toLowerCase()}`}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center text-center transition-all hover:ring-1 hover:ring-slate-300",
                    cfg.bg,
                    page ? "gap-0.5 rounded-md" : "rounded",
                    isTdy && "ring-2 ring-emerald-500",
                    isSel && "ring-2 ring-blue-500",
                  )}
                >
                  <span className={cn("font-medium leading-none", cfg.text, page ? "text-xs" : "text-[9px]")}>{d}</span>
                  {page ? (
                    <LuneSvg illumination={jour.illumination} croissante={estCroissante(jour)} className="h-4 w-4" />
                  ) : (
                    <span className="text-[10px] leading-none">{jour.emoji}</span>
                  )}
                </button>
              )
            })}
          </div>

          {selectedDay && (() => {
            const sc = configTypeJour(selectedDay.typeJour)
            return (
              <div className={cn("mt-2 rounded border bg-slate-50", page ? "p-3 text-sm" : "p-2 text-xs")}>
                <div className="mb-1 flex items-center gap-1.5">
                  <LuneSvg illumination={selectedDay.illumination} croissante={estCroissante(selectedDay)} className={cn("shrink-0", page ? "h-8 w-8" : "h-5 w-5")} />
                  <div className="min-w-0">
                    <p className="font-medium">{selectedDay.phase}</p>
                    <p className="truncate text-slate-400">
                      {FORMAT_JOUR.format(new Date(`${selectedDay.date}T12:00:00`))}
                      {" — "}
                      {selectedDay.illumination}%
                    </p>
                  </div>
                </div>
                <div className={cn("rounded", sc.bg, page ? "p-2" : "p-1.5")}>
                  <p className={cn("font-medium", sc.text, page ? "text-sm" : "text-[11px]")}>
                    {sc.emoji} Jour {sc.label}
                  </p>
                  <p className={cn("mt-0.5 text-slate-600", page ? "text-sm" : "text-[10px]")}>{selectedDay.conseil}</p>
                </div>
                {selectedDay.conseilVerger && <p className={cn("mt-1 text-slate-600", page ? "text-sm" : "text-[10px]")}>🌳 {selectedDay.conseilVerger}</p>}
              </div>
            )
          })()}

          <div className={cn("flex flex-wrap gap-1", page ? "mt-3" : "mt-2 justify-center")}>
            {Object.entries(TYPE_JOUR_CFG).map(([key, cfg]) => (
              <span key={key} className={cn("rounded-full", cfg.bg, cfg.text, page ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[9px]")}>
                {cfg.emoji} {cfg.label}
                {calData.stats[key] ? ` (${calData.stats[key]})` : ""}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className={cn("text-center text-slate-400", page ? "py-10 text-sm" : "py-4 text-xs")}>Calendrier indisponible</p>
      )}
    </>
  )

  if (!page) {
    return (
      <div className={className}>
        {blocAujourdhui}
        <div className="p-3">{grille}</div>
      </div>
    )
  }

  return (
    <section id={ANCRE_CALENDRIER_LUNAIRE} ref={section} className={cn("scroll-mt-4", className)} aria-labelledby="titre-calendrier-lunaire">
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="min-w-0">
              <h2 id="titre-calendrier-lunaire" className="flex items-center gap-2 text-base font-semibold text-encre">
                <Moon className="h-4 w-4 text-ardoise" aria-hidden />
                Calendrier lunaire
              </h2>
              {blocAujourdhui}
              <p className="mt-4 text-xs leading-relaxed text-ardoise">
                Phases calculées localement (instants vrais). Le type de jour suit l&rsquo;âge de la Lune par quartiers : feuille et fleur en Lune nouvelle, fruit vers la pleine Lune, racine ensuite, repos aux changements de phase.
              </p>
            </div>
            <div className="min-w-0 md:max-w-[460px]">{grille}</div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
