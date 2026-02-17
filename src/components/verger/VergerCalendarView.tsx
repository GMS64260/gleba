"use client"

/**
 * Vue Calendrier mensuel pour les operations du verger
 * Affiche les operations planifiees et realisees sur une grille mensuelle
 */

import * as React from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from "date-fns"
import { fr } from "date-fns/locale"
import {
  ChevronLeft,
  ChevronRight,
  Scissors,
  GitMerge,
  SprayCan,
  Flower2,
  Wrench,
  Check,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import { useToast } from "@/hooks/use-toast"

interface OperationEvent {
  id: number
  arbreId: number
  type: string
  date: string
  datePrevue: string | null
  fait: boolean
  description: string | null
  produit: string | null
  quantite: number | null
  unite: string | null
  cout: number | null
  arbre: { id: number; nom: string; type: string; espece: string }
}

interface VergerCalendarViewProps {
  year: number
  onToggleFait?: (op: OperationEvent) => void
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  taille: { icon: Scissors, color: "text-violet-600", bg: "bg-violet-100", label: "Taille" },
  greffe: { icon: GitMerge, color: "text-emerald-600", bg: "bg-emerald-100", label: "Greffe" },
  traitement: { icon: SprayCan, color: "text-red-500", bg: "bg-red-100", label: "Traitement" },
  fertilisation: { icon: Flower2, color: "text-amber-600", bg: "bg-amber-100", label: "Fertilisation" },
  autre: { icon: Wrench, color: "text-gray-600", bg: "bg-gray-100", label: "Autre" },
}

const WEEK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

export function VergerCalendarView({ year }: VergerCalendarViewProps) {
  const { toast } = useToast()
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date()
    return new Date(year, now.getMonth(), 1)
  })
  const [operations, setOperations] = React.useState<OperationEvent[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [openPopoverDay, setOpenPopoverDay] = React.useState<string | null>(null)
  const [selectedDayForMobile, setSelectedDayForMobile] = React.useState<{
    date: Date
    events: OperationEvent[]
  } | null>(null)
  const [daySheetOpen, setDaySheetOpen] = React.useState(false)

  // Update month when year changes
  React.useEffect(() => {
    setCurrentMonth((prev) => new Date(year, prev.getMonth(), 1))
  }, [year])

  // Fetch operations for the year
  React.useEffect(() => {
    async function fetchOps() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/arbres/operations?year=${year}`)
        if (res.ok) {
          setOperations(await res.json())
        }
      } catch {
        console.error("Erreur chargement operations calendrier")
      } finally {
        setIsLoading(false)
      }
    }
    fetchOps()
  }, [year])

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const goToToday = () => setCurrentMonth(startOfMonth(new Date()))

  const handleToggleFait = async (op: OperationEvent) => {
    try {
      const res = await fetch(`/api/arbres/operations/${op.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fait: !op.fait,
          ...(op.fait ? {} : { date: new Date().toISOString() }),
        }),
      })
      if (res.ok) {
        setOperations((prev) =>
          prev.map((o) => (o.id === op.id ? { ...o, fait: !op.fait } : o))
        )
        toast({ title: op.fait ? "Remis en attente" : "Fait !" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  // Build calendar grid
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

  // Group operations by day (use datePrevue for planned, date for done)
  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, OperationEvent[]>()
    operations.forEach((op) => {
      // Use datePrevue as the calendar date if available, otherwise use date
      const opDate = op.datePrevue || op.date
      if (!opDate) return
      const dateKey = format(new Date(opDate), "yyyy-MM-dd")
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)!.push(op)
    })
    return map
  }, [operations])

  // Count operations this month
  const monthOpsCount = React.useMemo(() => {
    let total = 0
    let done = 0
    days.forEach((d) => {
      if (!isSameMonth(d, currentMonth)) return
      const dateKey = format(d, "yyyy-MM-dd")
      const dayOps = eventsByDay.get(dateKey) || []
      total += dayOps.length
      done += dayOps.filter((o) => o.fait).length
    })
    return { total, done, remaining: total - done }
  }, [days, currentMonth, eventsByDay])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Calendrier des operations
            {monthOpsCount.total > 0 && (
              <Badge variant="secondary" className="text-xs">
                {monthOpsCount.remaining} a faire / {monthOpsCount.total}
              </Badge>
            )}
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
              Aujourd&apos;hui
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
          <Skeleton className="h-[350px] w-full" />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
              {/* Week day headers */}
              {WEEK_DAYS.map((d) => (
                <div
                  key={d}
                  className="bg-muted py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}

              {/* Calendar days */}
              {days.map((dayDate, idx) => {
                const dateKey = format(dayDate, "yyyy-MM-dd")
                const dayOps = eventsByDay.get(dateKey) || []
                const isCurrentMonth = isSameMonth(dayDate, currentMonth)
                const isCurrentDay = isToday(dayDate)

                // Group by type
                const byType: Record<string, OperationEvent[]> = {}
                dayOps.forEach((op) => {
                  if (!byType[op.type]) byType[op.type] = []
                  byType[op.type].push(op)
                })

                return (
                  <div
                    key={idx}
                    className={`
                      bg-background min-h-[60px] sm:min-h-[70px] p-1 relative transition-colors
                      ${!isCurrentMonth ? "opacity-40" : ""}
                      ${isCurrentDay ? "ring-2 ring-inset ring-lime-500" : ""}
                    `}
                  >
                    {/* Day number */}
                    <span
                      className={`
                        text-xs font-medium
                        ${isCurrentDay ? "text-lime-600 font-bold" : "text-muted-foreground"}
                      `}
                    >
                      {format(dayDate, "d")}
                    </span>

                    {/* Event indicators */}
                    {dayOps.length > 0 && (
                      <>
                        {/* Desktop: Popover */}
                        <div className="hidden sm:block">
                          <Popover
                            open={openPopoverDay === dateKey}
                            onOpenChange={(open) =>
                              setOpenPopoverDay(open ? dateKey : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <div className="absolute bottom-1 left-1 right-1 flex gap-0.5 flex-wrap cursor-pointer">
                                {Object.entries(byType).map(([type, ops]) => {
                                  const config = TYPE_CONFIG[type] || TYPE_CONFIG.autre
                                  const Icon = config.icon
                                  const allDone = ops.every((o) => o.fait)
                                  return (
                                    <div
                                      key={type}
                                      className={`relative flex items-center justify-center w-7 h-7 rounded ${
                                        allDone
                                          ? "bg-green-200 ring-1 ring-green-500"
                                          : config.bg
                                      }`}
                                    >
                                      <Icon
                                        className={`h-4 w-4 ${
                                          allDone ? "text-green-700" : config.color
                                        }`}
                                      />
                                      {allDone && (
                                        <span className="absolute -top-1 -right-1 text-green-600 text-[10px]">
                                          ✓
                                        </span>
                                      )}
                                      {ops.length > 1 && !allDone && (
                                        <span className="text-[9px] font-bold ml-px">
                                          {ops.length}
                                        </span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </PopoverTrigger>
                            <PopoverContent
                              side="bottom"
                              className="w-auto max-w-[340px] p-2"
                            >
                              <div className="space-y-1">
                                <p className="font-medium text-xs capitalize px-1">
                                  {format(dayDate, "EEEE d MMMM", { locale: fr })}
                                </p>
                                {dayOps.map((op) => {
                                  const config =
                                    TYPE_CONFIG[op.type] || TYPE_CONFIG.autre
                                  const Icon = config.icon
                                  return (
                                    <div
                                      key={op.id}
                                      className="flex items-center gap-1.5 text-xs hover:bg-accent rounded px-1.5 py-1 w-full transition-colors"
                                    >
                                      <button
                                        onClick={() => handleToggleFait(op)}
                                        className="flex-shrink-0"
                                        title={
                                          op.fait
                                            ? "Marquer non fait"
                                            : "Marquer fait"
                                        }
                                      >
                                        {op.fait ? (
                                          <Check className="h-4 w-4 text-green-600" />
                                        ) : (
                                          <div className="h-4 w-4 rounded border border-gray-300" />
                                        )}
                                      </button>
                                      <Icon
                                        className={`h-3.5 w-3.5 ${config.color} flex-shrink-0`}
                                      />
                                      <span
                                        className={`truncate ${
                                          op.fait
                                            ? "line-through opacity-60"
                                            : ""
                                        }`}
                                      >
                                        {op.arbre.nom}
                                      </span>
                                      <span className="text-muted-foreground capitalize flex-shrink-0">
                                        {config.label}
                                      </span>
                                      {op.description && (
                                        <span className="text-muted-foreground truncate">
                                          - {op.description}
                                        </span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Mobile: click opens Sheet */}
                        <div
                          className="sm:hidden absolute bottom-1 left-1 right-1 flex gap-0.5 flex-wrap cursor-pointer"
                          onClick={() => {
                            setSelectedDayForMobile({
                              date: dayDate,
                              events: dayOps,
                            })
                            setDaySheetOpen(true)
                          }}
                        >
                          {Object.entries(byType).map(([type, ops]) => {
                            const config = TYPE_CONFIG[type] || TYPE_CONFIG.autre
                            const Icon = config.icon
                            const allDone = ops.every((o) => o.fait)
                            return (
                              <div
                                key={type}
                                className={`relative flex items-center justify-center w-5 h-5 rounded ${
                                  allDone ? "bg-green-200" : config.bg
                                }`}
                              >
                                <Icon
                                  className={`h-3 w-3 ${
                                    allDone ? "text-green-700" : config.color
                                  }`}
                                />
                                {ops.length > 1 && (
                                  <span className="absolute -top-0.5 -right-0.5 bg-gray-600 text-white text-[7px] w-2.5 h-2.5 rounded-full flex items-center justify-center">
                                    {ops.length}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
              {Object.entries(TYPE_CONFIG).map(([type, config]) => {
                const Icon = config.icon
                return (
                  <div key={type} className="flex items-center gap-1">
                    <div
                      className={`w-5 h-5 rounded ${config.bg} flex items-center justify-center`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                    </div>
                    <span>{config.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Mobile Sheet */}
            <Sheet open={daySheetOpen} onOpenChange={setDaySheetOpen}>
              <SheetContent side="bottom" className="h-auto max-h-[70vh]">
                <SheetHeader>
                  <SheetTitle>
                    {selectedDayForMobile &&
                      format(
                        selectedDayForMobile.date,
                        "EEEE d MMMM yyyy",
                        { locale: fr }
                      )}
                  </SheetTitle>
                  <SheetDescription>
                    {selectedDayForMobile?.events.length} operation(s)
                  </SheetDescription>
                </SheetHeader>
                <div className="py-4 space-y-2 overflow-y-auto">
                  {selectedDayForMobile?.events.map((op) => {
                    const config = TYPE_CONFIG[op.type] || TYPE_CONFIG.autre
                    const Icon = config.icon
                    return (
                      <div
                        key={op.id}
                        className={`flex items-center gap-3 p-3 rounded-lg ${config.bg}`}
                      >
                        <button
                          onClick={() => handleToggleFait(op)}
                          className={`w-10 h-10 rounded-full bg-white/80 flex items-center justify-center flex-shrink-0`}
                        >
                          {op.fait ? (
                            <Check className="h-5 w-5 text-green-600" />
                          ) : (
                            <Icon className={`h-5 w-5 ${config.color}`} />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-medium ${
                              op.fait ? "line-through opacity-60" : ""
                            }`}
                          >
                            {op.arbre.nom}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {config.label}
                            {op.description && (
                              <span> - {op.description}</span>
                            )}
                          </p>
                        </div>
                        {op.fait ? (
                          <Badge className="bg-green-100 text-green-800">
                            Fait
                          </Badge>
                        ) : (
                          <Badge variant="outline">A faire</Badge>
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
