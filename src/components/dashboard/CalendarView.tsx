"use client"

/**
 * Vue Calendrier pour le Dashboard
 * Affiche les semis, plantations et récoltes du mois
 */

import * as React from "react"
import Link from "next/link"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns"
import { fr } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Sprout, Leaf, Package, Droplets } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { EventDialog } from "./EventDialog"

interface CalendarEvent {
  id: number
  type: "semis" | "plantation" | "recolte" | "irrigation"
  especeId: string
  date: string
  fait: boolean
  couleur: string | null
  cultureId?: number // Pour les irrigations, ID de la culture liée
}

interface CalendarViewProps {
  year: number
}

export function CalendarView({ year }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date()
    return new Date(year, now.getMonth(), 1)
  })
  const [events, setEvents] = React.useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null)
  const [eventDialogOpen, setEventDialogOpen] = React.useState(false)
  const [draggedEvent, setDraggedEvent] = React.useState<CalendarEvent | null>(null)
  const [draggedOverDay, setDraggedOverDay] = React.useState<string | null>(null)

  // Mettre à jour le mois quand l'année change
  React.useEffect(() => {
    setCurrentMonth(prev => new Date(year, prev.getMonth(), 1))
  }, [year])

  // Charger les événements du mois
  React.useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true)
      try {
        const start = startOfMonth(currentMonth)
        const end = endOfMonth(currentMonth)

        const response = await fetch(
          `/api/calendrier?start=${start.toISOString()}&end=${end.toISOString()}`
        )
        if (response.ok) {
          const data = await response.json()
          setEvents(data.events || [])
        }
      } catch (error) {
        console.error("Erreur chargement calendrier:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchEvents()
  }, [currentMonth])

  // Navigation
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const goToToday = () => setCurrentMonth(startOfMonth(new Date()))

  // Rafraîchir les événements après modification
  const refreshEvents = React.useCallback(async () => {
    try {
      const start = startOfMonth(currentMonth)
      const end = endOfMonth(currentMonth)

      const response = await fetch(
        `/api/calendrier?start=${start.toISOString()}&end=${end.toISOString()}`
      )
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
      }
    } catch (error) {
      console.error("Erreur chargement calendrier:", error)
    }
  }, [currentMonth])

  // Gestion du drag & drop
  const handleDragStart = (event: CalendarEvent, e: React.DragEvent) => {
    setDraggedEvent(event)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (dateKey: string, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDraggedOverDay(dateKey)
  }

  const handleDragLeave = () => {
    setDraggedOverDay(null)
  }

  const handleDrop = async (dateKey: string, e: React.DragEvent) => {
    e.preventDefault()
    setDraggedOverDay(null)

    if (!draggedEvent) return

    const newDate = new Date(dateKey)

    try {
      if (draggedEvent.type === "irrigation") {
        // Déplacer l'irrigation planifiée
        const response = await fetch(`/api/irrigations/${draggedEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datePrevue: newDate.toISOString(),
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Erreur")
        }
      } else {
        // Déterminer le champ à mettre à jour selon le type
        const fieldMap = {
          semis: "dateSemis",
          plantation: "datePlantation",
          recolte: "dateRecolte",
        }

        const field = fieldMap[draggedEvent.type as keyof typeof fieldMap]
        if (!field) return

        const response = await fetch(`/api/cultures/${draggedEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [field]: newDate.toISOString(),
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Erreur")
        }
      }

      // Mettre à jour localement
      setEvents(prev =>
        prev.map(ev =>
          ev.id === draggedEvent.id && ev.type === draggedEvent.type
            ? { ...ev, date: newDate.toISOString() }
            : ev
        )
      )

      // Rafraîchir depuis l'API
      refreshEvents()
    } catch (error) {
      console.error("Erreur déplacement:", error)
    } finally {
      setDraggedEvent(null)
    }
  }

  const handleDragEnd = () => {
    setDraggedEvent(null)
    setDraggedOverDay(null)
  }

  // Générer les jours du calendrier
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let day = calendarStart
  while (day <= calendarEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  // Grouper les événements par jour
  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach(event => {
      const dateKey = format(new Date(event.date), "yyyy-MM-dd")
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)!.push(event)
    })
    return map
  }, [events])

  // Icônes par type
  const typeIcons = {
    semis: { icon: Sprout, color: "text-orange-500", bg: "bg-orange-100" },
    plantation: { icon: Leaf, color: "text-green-500", bg: "bg-green-100" },
    recolte: { icon: Package, color: "text-purple-500", bg: "bg-purple-100" },
    irrigation: { icon: Droplets, color: "text-cyan-500", bg: "bg-cyan-100" },
  }

  // Jours de la semaine
  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            Calendrier des cultures
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={prevMonth} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToToday}
              className="h-8 px-2 text-xs"
            >
              Aujourd'hui
            </Button>
            <Button variant="ghost" size="sm" onClick={nextMonth} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: fr })}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <TooltipProvider delayDuration={100}>
            <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
              {/* En-têtes des jours */}
              {weekDays.map(d => (
                <div
                  key={d}
                  className="bg-muted py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}

              {/* Jours du calendrier */}
              {days.map((dayDate, idx) => {
                const dateKey = format(dayDate, "yyyy-MM-dd")
                const dayEvents = eventsByDay.get(dateKey) || []
                const isCurrentMonth = isSameMonth(dayDate, currentMonth)
                const isCurrentDay = isToday(dayDate)

                // Compter par type
                const counts = {
                  semis: dayEvents.filter(e => e.type === "semis").length,
                  plantation: dayEvents.filter(e => e.type === "plantation").length,
                  recolte: dayEvents.filter(e => e.type === "recolte").length,
                  irrigation: dayEvents.filter(e => e.type === "irrigation").length,
                }

                return (
                  <div
                    key={idx}
                    className={`
                      bg-background min-h-[60px] p-1 relative transition-colors
                      ${!isCurrentMonth ? "opacity-40" : ""}
                      ${isCurrentDay ? "ring-2 ring-inset ring-green-500" : ""}
                      ${draggedOverDay === dateKey ? "ring-2 ring-inset ring-blue-500 bg-blue-50" : ""}
                    `}
                    onDragOver={(e) => handleDragOver(dateKey, e)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(dateKey, e)}
                  >
                    {/* Numéro du jour */}
                    <span
                      className={`
                        text-xs font-medium
                        ${isCurrentDay ? "text-green-600" : "text-muted-foreground"}
                      `}
                    >
                      {format(dayDate, "d")}
                    </span>

                    {/* Indicateurs d'événements */}
                    {dayEvents.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="absolute bottom-1 left-1 right-1 flex gap-0.5 flex-wrap">
                            {counts.semis > 0 && (
                              <div className={`flex items-center justify-center w-6 h-6 rounded ${typeIcons.semis.bg}`}>
                                <Sprout className={`h-4 w-4 ${typeIcons.semis.color}`} />
                                {counts.semis > 1 && (
                                  <span className="text-[9px] font-bold ml-px">{counts.semis}</span>
                                )}
                              </div>
                            )}
                            {counts.plantation > 0 && (
                              <div className={`flex items-center justify-center w-6 h-6 rounded ${typeIcons.plantation.bg}`}>
                                <Leaf className={`h-4 w-4 ${typeIcons.plantation.color}`} />
                                {counts.plantation > 1 && (
                                  <span className="text-[9px] font-bold ml-px">{counts.plantation}</span>
                                )}
                              </div>
                            )}
                            {counts.recolte > 0 && (
                              <div className={`flex items-center justify-center w-6 h-6 rounded ${typeIcons.recolte.bg}`}>
                                <Package className={`h-4 w-4 ${typeIcons.recolte.color}`} />
                                {counts.recolte > 1 && (
                                  <span className="text-[9px] font-bold ml-px">{counts.recolte}</span>
                                )}
                              </div>
                            )}
                            {counts.irrigation > 0 && (
                              <div className={`flex items-center justify-center w-6 h-6 rounded ${typeIcons.irrigation.bg}`}>
                                <Droplets className={`h-4 w-4 ${typeIcons.irrigation.color}`} />
                                {counts.irrigation > 1 && (
                                  <span className="text-[9px] font-bold ml-px">{counts.irrigation}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[200px]">
                          <div className="space-y-1">
                            <p className="font-medium text-xs">
                              {format(dayDate, "EEEE d MMMM", { locale: fr })}
                            </p>
                            {dayEvents.slice(0, 5).map(event => {
                              const { icon: Icon, color } = typeIcons[event.type]
                              return (
                                <div
                                  key={`${event.id}-${event.type}`}
                                  draggable
                                  onDragStart={(e) => handleDragStart(event, e)}
                                  onDragEnd={handleDragEnd}
                                  onClick={() => {
                                    setSelectedEvent(event)
                                    setEventDialogOpen(true)
                                  }}
                                  className="flex items-center gap-1 text-xs hover:bg-accent/50 rounded px-1 py-0.5 w-full cursor-move transition-colors"
                                  title="Glisser pour déplacer"
                                >
                                  <Icon className={`h-4 w-4 ${color} flex-shrink-0`} />
                                  <span className={event.fait ? "line-through opacity-60" : ""}>
                                    {event.especeId}
                                  </span>
                                  {event.fait && <span className="text-green-600 ml-auto">✓</span>}
                                </div>
                              )
                            })}
                            {dayEvents.length > 5 && (
                              <p className="text-xs text-muted-foreground">
                                +{dayEvents.length - 5} autres...
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Légende */}
            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1">
                <div className={`w-5 h-5 rounded ${typeIcons.semis.bg} flex items-center justify-center`}>
                  <Sprout className={`h-3.5 w-3.5 ${typeIcons.semis.color}`} />
                </div>
                <span>Semis</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-5 h-5 rounded ${typeIcons.plantation.bg} flex items-center justify-center`}>
                  <Leaf className={`h-3.5 w-3.5 ${typeIcons.plantation.color}`} />
                </div>
                <span>Plantation</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-5 h-5 rounded ${typeIcons.recolte.bg} flex items-center justify-center`}>
                  <Package className={`h-3.5 w-3.5 ${typeIcons.recolte.color}`} />
                </div>
                <span>Récolte</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-5 h-5 rounded ${typeIcons.irrigation.bg} flex items-center justify-center`}>
                  <Droplets className={`h-3.5 w-3.5 ${typeIcons.irrigation.color}`} />
                </div>
                <span>Irrigation</span>
              </div>
              <div className="flex items-center gap-1 ml-2 text-[10px] text-blue-600">
                <span>💡 Glissez les événements pour les déplacer</span>
              </div>
            </div>

            {/* Lien vers tâches */}
            <div className="mt-3 text-center">
              <Link href="/taches">
                <Button variant="outline" size="sm">
                  Voir les tâches de la semaine
                </Button>
              </Link>
            </div>

            {/* Dialog pour gérer les événements */}
            <EventDialog
              event={selectedEvent}
              open={eventDialogOpen}
              onOpenChange={setEventDialogOpen}
              onUpdate={refreshEvents}
            />
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  )
}
