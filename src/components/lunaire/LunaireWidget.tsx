"use client"

/**
 * Widget lunaire compact pour le header
 * Pattern identique à HeaderMeteoWidget : bouton responsive + Popover
 */

import * as React from "react"
import { Moon, ChevronLeft, ChevronRight, ChevronDown, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { EVENEMENT_OUVRIR_LUNE, enregistrerCalendrierLunaire } from "@/lib/accueil/evenements"

interface JourLunaire {
  date: string
  phase: string
  phaseIndex: number
  illumination: number
  age: number
  emoji: string
  typeJour: "feuille" | "fruit" | "racine" | "fleur" | "repos"
  conseil: string
  conseilVerger?: string
  couleur: string
}

interface CalendrierData {
  calendrier: { year: number; month: number; jours: JourLunaire[] }
  stats: Record<string, number>
}

const TYPE_CFG: Record<string, { label: string; emoji: string; bg: string; text: string }> = {
  feuille: { label: "Feuille", emoji: "🍃", bg: "bg-green-100", text: "text-green-700" },
  fruit: { label: "Fruit", emoji: "🍅", bg: "bg-orange-100", text: "text-orange-700" },
  racine: { label: "Racine", emoji: "🌱", bg: "bg-amber-100", text: "text-amber-800" },
  fleur: { label: "Fleur", emoji: "🌸", bg: "bg-pink-100", text: "text-pink-700" },
  repos: { label: "Repos", emoji: "⏸️", bg: "bg-slate-100", text: "text-slate-500" },
}

const MOIS = [
  "", "Janv.", "Fév.", "Mars", "Avr.", "Mai", "Juin",
  "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc.",
]
const JOURS_SEM = ["L", "M", "M", "J", "V", "S", "D"]

export interface LunaireWidgetProps {
  /** Dans le bandeau météo de l'en-tête historique : sans bordure, pleine hauteur. */
  embedded?: boolean
  /** Libellé à côté de la phase du jour (rail de l'accueil v2) ; sans lui, phase seule. */
  libelle?: string
  /** Classes du bouton quand `libelle` est donné (entrée du rail). */
  triggerClassName?: string
  className?: string
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}

/**
 * Lecture du jour partagée entre les instances d'une même page (rail et
 * en-tête, relecture du 2026-10-12) : une seule requête par jour civil.
 */
let lectureDuJour: { jour: string; promesse: Promise<JourLunaire | null> } | null = null
function lireJourLunaire(jour: string): Promise<JourLunaire | null> {
  if (lectureDuJour?.jour !== jour) {
    const promesse = fetch("/api/lunaire?today=1")
      .then((r) => r.json())
      .then((json) => (json.jour ?? null) as JourLunaire | null)
      .catch(() => null)
    lectureDuJour = { jour, promesse }
    // Un échec ne se mémorise pas : la prochaine instance retente.
    promesse.then((j) => { if (j === null && lectureDuJour?.promesse === promesse) lectureDuJour = null })
  }
  return lectureDuJour.promesse
}

export function LunaireWidget({ embedded = false, libelle, triggerClassName, className, side = "bottom", align = "end" }: LunaireWidgetProps) {
  const [today, setToday] = React.useState<JourLunaire | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [calData, setCalData] = React.useState<CalendrierData | null>(null)
  const [calLoading, setCalLoading] = React.useState(false)

  const now = new Date()
  const [year, setYear] = React.useState(now.getFullYear())
  const [month, setMonth] = React.useState(now.getMonth() + 1)
  const [selectedDay, setSelectedDay] = React.useState<JourLunaire | null>(null)
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  // Audit fuseaux #78 : jour LOCAL (year/month sont locaux). toISOString() donne
  // le jour UTC → entre minuit et 2h, « aujourd'hui » tombait sur la veille.
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  React.useEffect(() => {
    let annule = false
    lireJourLunaire(todayStr).then((jour) => {
      if (annule) return
      setToday(jour)
      setLoading(false)
    })
    return () => {
      annule = true
    }
  }, [todayStr])

  const fetchCalendar = React.useCallback((y: number, m: number) => {
    setCalLoading(true)
    setSelectedDay(null)
    fetch(`/api/lunaire?year=${y}&month=${m}`)
      .then((r) => r.json())
      .then((json) => setCalData(json))
      .catch(() => setCalData(null))
      .finally(() => setCalLoading(false))
  }, [])

  const handleOpenChange = React.useCallback((ouvert: boolean) => {
    setOpen(ouvert)
    if (ouvert && !calData) fetchCalendar(year, month)
  }, [year, month, calData, fetchCalendar])

  // Accueil v2 (ticket QA cmv4zb9yy) : la palette et la tuile Raccourcis
  // ouvrent ce calendrier par événement. Seul le widget visible répond : sur
  // une même page, un autre peut être masqué par la grille responsive (rail
  // sur grand écran, en-tête sur téléphone).
  React.useEffect(() => {
    const visible = () => Boolean(triggerRef.current && triggerRef.current.getClientRects().length > 0)
    const desinscrire = enregistrerCalendrierLunaire(visible)
    const ouvrir = () => {
      if (!visible()) return
      // Le déclencheur peut être défilé hors écran (en-tête de l'accueil sur
      // téléphone, raccourci en bas de page) : le popover s'ancre dessus.
      triggerRef.current?.scrollIntoView({ block: "nearest" })
      handleOpenChange(true)
    }
    window.addEventListener(EVENEMENT_OUVRIR_LUNE, ouvrir)
    return () => {
      desinscrire()
      window.removeEventListener(EVENEMENT_OUVRIR_LUNE, ouvrir)
    }
  }, [handleOpenChange])

  const navMonth = (delta: number) => {
    let m = month + delta, y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m)
    setYear(y)
    fetchCalendar(y, m)
  }

  if (loading) {
    return (
      <div className={`flex items-center px-2 py-1 text-ardoise/60 ${className ?? ""}`} aria-label={libelle ?? "Calendrier lunaire"} aria-busy="true">
        <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />
        {libelle && <span className="ml-2.5 text-sm">{libelle}</span>}
      </div>
    )
  }

  if (!today) return null

  const tc = TYPE_CFG[today.typeJour] || TYPE_CFG.repos
  const firstDay = new Date(year, month - 1, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {libelle ? (
          <button ref={triggerRef} type="button" className={`${triggerClassName ?? ""} ${className ?? ""}`} aria-haspopup="dialog" aria-expanded={open}>
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-base leading-none" aria-hidden>{today.emoji}</span>
            {libelle}
          </button>
        ) : (
          <button ref={triggerRef} type="button" className={`flex items-center justify-center gap-1.5 px-2 sm:px-3 transition-colors group ${
            embedded
              ? "h-full bg-papier hover:bg-lin-doux"
              : "min-h-11 rounded-xl border border-lin bg-craie py-1.5 hover:border-sauge sm:py-2"
          } ${className ?? ""}`} aria-label="Calendrier lunaire" aria-haspopup="dialog" aria-expanded={open}>
            <span className="text-base leading-none">{today.emoji}</span>
            <ChevronDown className="h-3 w-3 text-ardoise group-hover:text-encre" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,calc(100vw-1rem))] p-0" side={side} align={align} sideOffset={8}>
        {/* Aujourd'hui */}
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{today.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{today.phase}</p>
              <p className="text-xs text-slate-500">{today.illumination}% illumination</p>
            </div>
          </div>
          <div className={`rounded-md p-2 ${tc.bg}`}>
            <p className={`text-sm font-medium ${tc.text}`}>{tc.emoji} Jour {tc.label}</p>
            <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{today.conseil}</p>
          </div>
          {today.conseilVerger && (
            <p className="text-xs text-slate-600 leading-relaxed mt-1.5">🌳 {today.conseilVerger}</p>
          )}
        </div>

        {/* Calendrier */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
              <Moon className="h-3.5 w-3.5" />
              Calendrier
            </span>
            <div className="flex items-center gap-0.5">
              <button onClick={() => navMonth(-1)} className="p-0.5 rounded hover:bg-slate-100">
                <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />
              </button>
              <span className="text-[11px] font-medium min-w-[70px] text-center text-slate-600">
                {MOIS[month]} {year}
              </span>
              <button onClick={() => navMonth(1)} className="p-0.5 rounded hover:bg-slate-100">
                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              </button>
            </div>
          </div>

          {calLoading ? (
            <div className="flex items-center justify-center py-6 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : calData ? (
            <>
              <div className="grid grid-cols-7 gap-px">
                {JOURS_SEM.map((j, i) => (
                  <div key={i} className="text-center text-[9px] text-slate-400 font-medium py-0.5">{j}</div>
                ))}
                {Array.from({ length: offset }).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}
                {calData.calendrier.jours.map((jour) => {
                  const d = parseInt(jour.date.split("-")[2])
                  const cfg = TYPE_CFG[jour.typeJour] || TYPE_CFG.repos
                  const isTdy = jour.date === todayStr
                  const isSel = selectedDay?.date === jour.date

                  return (
                    <button
                      key={jour.date}
                      onClick={() => setSelectedDay(isSel ? null : jour)}
                      className={`aspect-square rounded flex flex-col items-center justify-center text-center transition-all
                        ${cfg.bg} hover:ring-1 hover:ring-slate-300
                        ${isTdy ? "ring-2 ring-emerald-500" : ""}
                        ${isSel ? "ring-2 ring-blue-500" : ""}
                      `}
                    >
                      <span className={`text-[9px] font-medium leading-none ${cfg.text}`}>{d}</span>
                      <span className="text-[10px] leading-none">{jour.emoji}</span>
                    </button>
                  )
                })}
              </div>

              {/* Détail sélectionné */}
              {selectedDay && (() => {
                const sc = TYPE_CFG[selectedDay.typeJour] || TYPE_CFG.repos
                return (
                  <div className="mt-2 p-2 bg-slate-50 rounded border text-xs">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-lg leading-none">{selectedDay.emoji}</span>
                      <div className="min-w-0">
                        <p className="font-medium">{selectedDay.phase}</p>
                        <p className="text-slate-400 truncate">
                          {new Date(selectedDay.date).toLocaleDateString("fr-FR", {
                            weekday: "short", day: "numeric", month: "short",
                          })}
                          {" — "}{selectedDay.illumination}%
                        </p>
                      </div>
                    </div>
                    <div className={`rounded p-1.5 ${sc.bg}`}>
                      <p className={`text-[11px] font-medium ${sc.text}`}>{sc.emoji} Jour {sc.label}</p>
                      <p className="text-slate-600 text-[10px] mt-0.5">{selectedDay.conseil}</p>
                    </div>
                    {selectedDay.conseilVerger && (
                      <p className="text-slate-600 text-[10px] mt-1">🌳 {selectedDay.conseilVerger}</p>
                    )}
                  </div>
                )
              })()}

              {/* Légende */}
              <div className="mt-2 flex flex-wrap gap-1 justify-center">
                {Object.entries(TYPE_CFG).map(([key, cfg]) => (
                  <span key={key} className={`text-[9px] px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                    {cfg.emoji} {cfg.label}
                    {calData.stats[key] ? ` (${calData.stats[key]})` : ""}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">Calendrier indisponible</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
