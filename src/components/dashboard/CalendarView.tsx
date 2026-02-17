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
import { ChevronLeft, ChevronRight, Sprout, Leaf, Package, Droplets, Calendar, CalendarDays } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { EventDialog } from "./EventDialog"
import { YearView } from "./YearView"

interface CalendarEvent {
  id: number
  type: "semis" | "plantation" | "recolte" | "irrigation"
  especeId: string
  varieteId: string | null
  plancheName: string | null
  ilot: string | null
  date: string
  fait: boolean
  couleur: string | null
  cultureId?: number // Pour les irrigations, ID de la culture liée
}

interface CalendarViewProps {
  year: number
}

export function CalendarView({ year }: CalendarViewProps) {
  const [viewMode, setViewMode] = React.useState<'month' | 'year'>('month')
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date()
    return new Date(year, now.getMonth(), 1)
  })
  const [events, setEvents] = React.useState<CalendarEvent[]>([])
  const [yearEvents, setYearEvents] = React.useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null)
  const [eventDialogOpen, setEventDialogOpen] = React.useState(false)
  const [draggedEvent, setDraggedEvent] = React.useState<CalendarEvent | null>(null)
  const [draggedOverDay, setDraggedOverDay] = React.useState<string | null>(null)
  // Desktop: popover state for day events
  const [openPopoverDay, setOpenPopoverDay] = React.useState<string | null>(null)
  // Mobile: day sheet state
  const [selectedDayForMobile, setSelectedDayForMobile] = React.useState<{ date: Date; events: CalendarEvent[] } | null>(null)
  const [daySheetOpen, setDaySheetOpen] = React.useState(false)

  // Mettre à jour le mois quand l'année change
  React.useEffect(() => {
    setCurrentMonth(prev => new Date(year, prev.getMonth(), 1))
  }, [year])

  // Charger les événements (mois ou année)
  React.useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true)
      try {
        if (viewMode === 'month') {
          // Charger événements du mois
          const start = startOfMonth(currentMonth)
          const end = endOfMonth(currentMonth)

          const response = await fetch(
            `/api/calendrier?start=${start.toISOString()}&end=${end.toISOString()}`
          )
          if (response.ok) {
            const data = await response.json()
            setEvents(data.events || [])
          }
        } else {
          // Charger événements de l'année
          const start = new Date(year, 0, 1)
          const end = new Date(year, 11, 31, 23, 59, 59)

          const response = await fetch(
            `/api/calendrier?start=${start.toISOString()}&end=${end.toISOString()}`
          )
          if (response.ok) {
            const data = await response.json()
            setYearEvents(data.events || [])
          }
        }
      } catch (error) {
        console.error("Erreur chargement calendrier:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchEvents()
  }, [currentMonth, viewMode, year])

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
    setOpenPopoverDay(null) // Fermer le popover pour voir les cellules cibles
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Calendrier des cultures
          </CardTitle>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle Vue Mois/Année */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'year')}>
              <TabsList className="h-8">
                <TabsTrigger value="month" className="text-xs h-7 px-2">
                  <Calendar className="h-3 w-3 mr-1" />
                  Mois
                </TabsTrigger>
                <TabsTrigger value="year" className="text-xs h-7 px-2">
                  <CalendarDays className="h-3 w-3 mr-1" />
                  Année
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Navigation (seulement en vue mois) */}
            {viewMode === 'month' && (
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
            )}
          </div>
        </div>
        {viewMode === 'month' && (
          <p className="text-sm text-muted-foreground capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: fr })}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : viewMode === 'year' ? (
          <YearView
            year={year}
            events={yearEvents}
            onMonthClick={(month) => {
              setCurrentMonth(new Date(year, month, 1))
              setViewMode('month')
            }}
          />
        ) : (
          <>
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

                // Compter par type et statut
                const semisEvents = dayEvents.filter(e => e.type === "semis")
                const plantationEvents = dayEvents.filter(e => e.type === "plantation")
                const recolteEvents = dayEvents.filter(e => e.type === "recolte")
                const irrigationEvents = dayEvents.filter(e => e.type === "irrigation")

                const counts = {
                  semis: semisEvents.length,
                  plantation: plantationEvents.length,
                  recolte: recolteEvents.length,
                  irrigation: irrigationEvents.length,
                }

                // Indicateurs de complétion (tous faits)
                const allDone = {
                  semis: semisEvents.length > 0 && semisEvents.every(e => e.fait),
                  plantation: plantationEvents.length > 0 && plantationEvents.every(e => e.fait),
                  recolte: recolteEvents.length > 0 && recolteEvents.every(e => e.fait),
                  irrigation: irrigationEvents.length > 0 && irrigationEvents.every(e => e.fait),
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
                      <>
                        {/* Desktop: Popover au clic */}
                        <div className="hidden sm:block">
                          <Popover open={openPopoverDay === dateKey} onOpenChange={(open) => setOpenPopoverDay(open ? dateKey : null)}>
                            <PopoverTrigger asChild>
                              <div className="absolute bottom-1 left-1 right-1 flex gap-1 flex-wrap cursor-pointer">
                                {counts.semis > 0 && (
                                  <div className={`relative flex items-center justify-center w-8 h-8 rounded ${
                                    allDone.semis ? 'bg-green-200 ring-1 ring-green-500' : typeIcons.semis.bg
                                  }`}>
                                    <Sprout className={`h-5 w-5 ${allDone.semis ? 'text-green-700' : typeIcons.semis.color}`} />
                                    {allDone.semis && (
                                      <span className="absolute -top-1 -right-1 text-green-600 text-xs">✓</span>
                                    )}
                                    {counts.semis > 1 && !allDone.semis && (
                                      <span className="text-[10px] font-bold ml-px">{counts.semis}</span>
                                    )}
                                  </div>
                                )}
                                {counts.plantation > 0 && (
                                  <div className={`relative flex items-center justify-center w-8 h-8 rounded ${
                                    allDone.plantation ? 'bg-green-200 ring-1 ring-green-500' : typeIcons.plantation.bg
                                  }`}>
                                    <Leaf className={`h-5 w-5 ${allDone.plantation ? 'text-green-700' : typeIcons.plantation.color}`} />
                                    {allDone.plantation && (
                                      <span className="absolute -top-1 -right-1 text-green-600 text-xs">✓</span>
                                    )}
                                    {counts.plantation > 1 && !allDone.plantation && (
                                      <span className="text-[10px] font-bold ml-px">{counts.plantation}</span>
                                    )}
                                  </div>
                                )}
                                {counts.recolte > 0 && (
                                  <div className={`relative flex items-center justify-center w-8 h-8 rounded ${
                                    allDone.recolte ? 'bg-green-200 ring-1 ring-green-500' : typeIcons.recolte.bg
                                  }`}>
                                    <Package className={`h-5 w-5 ${allDone.recolte ? 'text-green-700' : typeIcons.recolte.color}`} />
                                    {allDone.recolte && (
                                      <span className="absolute -top-1 -right-1 text-green-600 text-xs">✓</span>
                                    )}
                                    {counts.recolte > 1 && !allDone.recolte && (
                                      <span className="text-[10px] font-bold ml-px">{counts.recolte}</span>
                                    )}
                                  </div>
                                )}
                                {counts.irrigation > 0 && (
                                  <div className={`relative flex items-center justify-center w-8 h-8 rounded ${
                                    allDone.irrigation ? 'bg-green-200 ring-1 ring-green-500' : typeIcons.irrigation.bg
                                  }`}>
                                    <Droplets className={`h-5 w-5 ${allDone.irrigation ? 'text-green-700' : typeIcons.irrigation.color}`} />
                                    {allDone.irrigation && (
                                      <span className="absolute -top-1 -right-1 text-green-600 text-xs">✓</span>
                                    )}
                                    {counts.irrigation > 1 && !allDone.irrigation && (
                                      <span className="text-[10px] font-bold ml-px">{counts.irrigation}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </PopoverTrigger>
                            <PopoverContent side="bottom" className="w-auto max-w-[320px] p-2">
                              <div className="space-y-1">
                                <p className="font-medium text-xs capitalize px-1">
                                  {format(dayDate, "EEEE d MMMM", { locale: fr })}
                                </p>
                                {dayEvents.map(event => {
                                  const { icon: Icon, color } = typeIcons[event.type]
                                  return (
                                    <div
                                      key={`${event.id}-${event.type}`}
                                      draggable
                                      onDragStart={(e) => handleDragStart(event, e)}
                                      onDragEnd={handleDragEnd}
                                      onClick={() => {
                                        setOpenPopoverDay(null)
                                        setSelectedEvent(event)
                                        setEventDialogOpen(true)
                                      }}
                                      className="flex items-center gap-1.5 text-xs hover:bg-accent rounded px-1.5 py-1 w-full cursor-grab active:cursor-grabbing transition-colors"
                                      title="Glisser pour déplacer, cliquer pour détails"
                                    >
                                      <Icon className={`h-4 w-4 ${color} flex-shrink-0`} />
                                      <span className={`truncate ${event.fait ? "line-through opacity-60" : ""}`}>
                                        {event.especeId}
                                        {event.varieteId && <span className="text-muted-foreground"> ({event.varieteId})</span>}
                                      </span>
                                      {event.plancheName && (
                                        <span className="text-muted-foreground flex-shrink-0">→ {event.plancheName}</span>
                                      )}
                                      {event.fait && <span className="text-green-600 ml-auto flex-shrink-0">✓</span>}
                                    </div>
                                  )
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Mobile: Clic direct ouvre le Sheet */}
                        <div
                          className="sm:hidden absolute bottom-1 left-1 right-1 flex gap-0.5 flex-wrap cursor-pointer"
                          onClick={() => {
                            setSelectedDayForMobile({ date: dayDate, events: dayEvents })
                            setDaySheetOpen(true)
                          }}
                        >
                          {counts.semis > 0 && (
                            <div className={`relative flex items-center justify-center w-6 h-6 rounded ${
                              allDone.semis ? 'bg-green-200' : typeIcons.semis.bg
                            }`}>
                              <Sprout className={`h-4 w-4 ${allDone.semis ? 'text-green-700' : typeIcons.semis.color}`} />
                              {counts.semis > 1 && (
                                <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-[8px] w-3 h-3 rounded-full flex items-center justify-center">{counts.semis}</span>
                              )}
                            </div>
                          )}
                          {counts.plantation > 0 && (
                            <div className={`relative flex items-center justify-center w-6 h-6 rounded ${
                              allDone.plantation ? 'bg-green-200' : typeIcons.plantation.bg
                            }`}>
                              <Leaf className={`h-4 w-4 ${allDone.plantation ? 'text-green-700' : typeIcons.plantation.color}`} />
                              {counts.plantation > 1 && (
                                <span className="absolute -top-0.5 -right-0.5 bg-green-500 text-white text-[8px] w-3 h-3 rounded-full flex items-center justify-center">{counts.plantation}</span>
                              )}
                            </div>
                          )}
                          {counts.recolte > 0 && (
                            <div className={`relative flex items-center justify-center w-6 h-6 rounded ${
                              allDone.recolte ? 'bg-green-200' : typeIcons.recolte.bg
                            }`}>
                              <Package className={`h-4 w-4 ${allDone.recolte ? 'text-green-700' : typeIcons.recolte.color}`} />
                              {counts.recolte > 1 && (
                                <span className="absolute -top-0.5 -right-0.5 bg-purple-500 text-white text-[8px] w-3 h-3 rounded-full flex items-center justify-center">{counts.recolte}</span>
                              )}
                            </div>
                          )}
                          {counts.irrigation > 0 && (
                            <div className={`relative flex items-center justify-center w-6 h-6 rounded ${
                              allDone.irrigation ? 'bg-green-200' : typeIcons.irrigation.bg
                            }`}>
                              <Droplets className={`h-4 w-4 ${allDone.irrigation ? 'text-green-700' : typeIcons.irrigation.color}`} />
                              {counts.irrigation > 1 && (
                                <span className="absolute -top-0.5 -right-0.5 bg-cyan-500 text-white text-[8px] w-3 h-3 rounded-full flex items-center justify-center">{counts.irrigation}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </>
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
              <div className="hidden sm:flex items-center gap-1 ml-2 text-[10px] text-blue-600">
                <span>💡 Cliquez sur un jour, puis glissez un événement pour le déplacer</span>
              </div>
              <div className="sm:hidden flex items-center gap-1 ml-2 text-[10px] text-blue-600">
                <span>💡 Cliquez sur un jour pour voir les détails</span>
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

            {/* Sheet mobile pour les événements du jour */}
            <Sheet open={daySheetOpen} onOpenChange={setDaySheetOpen}>
              <SheetContent side="bottom" className="h-auto max-h-[70vh]">
                <SheetHeader>
                  <SheetTitle>
                    {selectedDayForMobile && format(selectedDayForMobile.date, "EEEE d MMMM yyyy", { locale: fr })}
                  </SheetTitle>
                  <SheetDescription>
                    {selectedDayForMobile?.events.length} événement(s)
                  </SheetDescription>
                </SheetHeader>
                <div className="py-4 space-y-2 overflow-y-auto">
                  {selectedDayForMobile?.events.map(event => {
                    const { icon: Icon, color, bg } = typeIcons[event.type]
                    const typeLabel = {
                      semis: "Semis",
                      plantation: "Plantation",
                      recolte: "Récolte",
                      irrigation: "Irrigation",
                    }
                    return (
                      <div
                        key={`${event.id}-${event.type}`}
                        onClick={() => {
                          setSelectedEvent(event)
                          setDaySheetOpen(false)
                          setEventDialogOpen(true)
                        }}
                        className={`flex items-center gap-3 p-3 rounded-lg ${bg} cursor-pointer active:opacity-70 transition-opacity`}
                      >
                        <div className={`w-10 h-10 rounded-full bg-white/80 flex items-center justify-center`}>
                          <Icon className={`h-5 w-5 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${event.fait ? "line-through opacity-60" : ""}`}>
                            {event.especeId}
                            {event.varieteId && <span className="font-normal text-muted-foreground"> ({event.varieteId})</span>}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {typeLabel[event.type]}
                            {event.plancheName && <span> · {event.plancheName}</span>}
                          </p>
                        </div>
                        {event.fait ? (
                          <Badge className="bg-green-100 text-green-800">Fait</Badge>
                        ) : (
                          <Badge variant="outline">À faire</Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </CardContent>
    </Card>
  )
}
