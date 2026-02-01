"use client"

/**
 * Vue Annuelle du Calendrier
 * Affiche 12 mois en grille avec densité d'événements
 */

import * as React from "react"
import { format, getDaysInMonth } from "date-fns"
import { fr } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sprout, Leaf, Package, Droplets } from "lucide-react"

interface CalendarEvent {
  id: number
  type: "semis" | "plantation" | "recolte" | "irrigation"
  especeId: string
  date: string
  fait: boolean
  couleur: string | null
  cultureId?: number
}

interface YearViewProps {
  year: number
  events: CalendarEvent[]
  onMonthClick: (month: number) => void
}

export function YearView({ year, events, onMonthClick }: YearViewProps) {
  // Grouper événements par mois (0-11)
  const eventsByMonth = React.useMemo(() => {
    const months: Record<number, CalendarEvent[]> = {}
    for (let m = 0; m < 12; m++) {
      months[m] = []
    }

    events.forEach(event => {
      const eventDate = new Date(event.date)
      const month = eventDate.getMonth()
      if (months[month]) {
        months[month].push(event)
      }
    })

    return months
  }, [events])

  // Calculer stats par mois
  const getMonthStats = (month: number) => {
    const monthEvents = eventsByMonth[month] || []
    return {
      semis: monthEvents.filter(e => e.type === 'semis').length,
      plantation: monthEvents.filter(e => e.type === 'plantation').length,
      recolte: monthEvents.filter(e => e.type === 'recolte').length,
      irrigation: monthEvents.filter(e => e.type === 'irrigation').length,
      total: monthEvents.length,
    }
  }

  const MOIS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {MOIS.map((mois, index) => {
        const stats = getMonthStats(index)
        const hasEvents = stats.total > 0

        return (
          <Card
            key={index}
            className={`cursor-pointer transition-all hover:shadow-md ${
              hasEvents ? 'border-green-200 hover:border-green-400' : ''
            }`}
            onClick={() => onMonthClick(index)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>{mois}</span>
                {hasEvents && (
                  <Badge variant="secondary" className="text-xs">
                    {stats.total}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              {hasEvents ? (
                <div className="space-y-1.5">
                  {stats.semis > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Sprout className="h-3.5 w-3.5 text-orange-500" />
                        <span className="text-muted-foreground">Semis</span>
                      </div>
                      <Badge variant="outline" className="h-5 px-1.5 text-xs bg-orange-50 text-orange-700 border-orange-200">
                        {stats.semis}
                      </Badge>
                    </div>
                  )}
                  {stats.plantation > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Leaf className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-muted-foreground">Plant.</span>
                      </div>
                      <Badge variant="outline" className="h-5 px-1.5 text-xs bg-green-50 text-green-700 border-green-200">
                        {stats.plantation}
                      </Badge>
                    </div>
                  )}
                  {stats.recolte > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-purple-500" />
                        <span className="text-muted-foreground">Récolte</span>
                      </div>
                      <Badge variant="outline" className="h-5 px-1.5 text-xs bg-purple-50 text-purple-700 border-purple-200">
                        {stats.recolte}
                      </Badge>
                    </div>
                  )}
                  {stats.irrigation > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Droplets className="h-3.5 w-3.5 text-cyan-500" />
                        <span className="text-muted-foreground">Irrig.</span>
                      </div>
                      <Badge variant="outline" className="h-5 px-1.5 text-xs bg-cyan-50 text-cyan-700 border-cyan-200">
                        {stats.irrigation}
                      </Badge>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Aucun événement
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
