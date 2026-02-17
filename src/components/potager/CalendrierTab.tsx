"use client"

/**
 * Onglet Calendrier & Tâches - Vue par défaut du potager
 * Combine le calendrier des cultures et la liste des tâches de la semaine
 */

import * as React from "react"
import Link from "next/link"
import {
  CheckCircle2,
  Circle,
  Sprout,
  Leaf,
  Package,
  Droplets,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { CalendarView } from "@/components/dashboard/CalendarView"
import { ItpCalendarView } from "@/components/dashboard/ItpCalendarView"
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns"
import { fr } from "date-fns/locale"

interface DashboardStats {
  culturesActives: number
  culturesTotal: number
  planches: number
  surfaceTotale: number
  recoltesAnnee: number
  recoltesAnneePrecedente: number
}

interface TacheItem {
  id: number
  type: "semis" | "plantation" | "recolte"
  especeId: string
  varieteId: string | null
  plancheId: string | null
  date: string
  fait: boolean
  couleur: string | null
}

interface IrrigationItem {
  id: number
  cultureId: number
  especeId: string
  plancheId: string | null
  ilot: string | null
  datePrevue: string
  fait: boolean
  couleur: string | null
}

interface TachesData {
  semis: TacheItem[]
  plantations: TacheItem[]
  recoltes: TacheItem[]
  irrigation: IrrigationItem[]
  stats: {
    semisPrevus: number
    semisFaits: number
    plantationsPrevues: number
    plantationsFaites: number
    recoltesPrevues: number
    recoltesFaites: number
    aIrriguer: number
  }
}

interface CalendrierTabProps {
  year: number
}

export function CalendrierTab({ year }: CalendrierTabProps) {
  const { toast } = useToast()
  const [calendarMode, setCalendarMode] = React.useState<"cultures" | "itps">("cultures")
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [taches, setTaches] = React.useState<TachesData | null>(null)
  const [loadingStats, setLoadingStats] = React.useState(true)
  const [loadingTaches, setLoadingTaches] = React.useState(true)
  const [weekOffset, setWeekOffset] = React.useState(0)

  const { weekStart, weekEnd } = React.useMemo(() => {
    const base = new Date()
    const current = addWeeks(base, weekOffset)
    return {
      weekStart: startOfWeek(current, { weekStartsOn: 1 }),
      weekEnd: endOfWeek(current, { weekStartsOn: 1 }),
    }
  }, [weekOffset])

  // Charger stats dashboard
  React.useEffect(() => {
    async function fetchStats() {
      setLoadingStats(true)
      try {
        const res = await fetch(`/api/dashboard?year=${year}`)
        if (res.ok) {
          const json = await res.json()
          setStats(json.stats)
        }
      } catch {
        // silent
      } finally {
        setLoadingStats(false)
      }
    }
    fetchStats()
  }, [year])

  // Charger tâches
  const fetchTaches = React.useCallback(async () => {
    setLoadingTaches(true)
    try {
      const res = await fetch(
        `/api/taches?start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`
      )
      if (res.ok) {
        const result = await res.json()
        setTaches(result)
      }
    } catch {
      // silent
    } finally {
      setLoadingTaches(false)
    }
  }, [weekStart, weekEnd])

  React.useEffect(() => {
    fetchTaches()
  }, [fetchTaches])

  // Toggle tâche
  const toggleTache = async (
    cultureId: number,
    type: "semis" | "plantation" | "recolte",
    currentValue: boolean,
    especeId: string
  ) => {
    if (type === "recolte" && !currentValue) {
      const quantiteStr = prompt("Quantite recoltee (kg) :")
      if (!quantiteStr) return
      const quantite = parseFloat(quantiteStr)
      if (isNaN(quantite) || quantite <= 0) {
        toast({ variant: "destructive", title: "Quantite invalide" })
        return
      }
      try {
        await fetch("/api/recoltes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cultureId, especeId, date: new Date().toISOString(), quantite }),
        })
        await fetch(`/api/cultures/${cultureId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recolteFaite: true }),
        })
        toast({ title: "Recolte enregistree", description: `${quantite} kg` })
        fetchTaches()
      } catch {
        toast({ variant: "destructive", title: "Erreur" })
      }
      return
    }

    try {
      const fieldMap = { semis: "semisFait", plantation: "plantationFaite", recolte: "recolteFaite" }
      await fetch(`/api/cultures/${cultureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldMap[type]]: !currentValue }),
      })
      setTaches((prev) => {
        if (!prev) return prev
        const key = type === "semis" ? "semis" : type === "plantation" ? "plantations" : "recoltes"
        return {
          ...prev,
          [key]: prev[key].map((t) => (t.id === cultureId ? { ...t, fait: !currentValue } : t)),
        }
      })
      toast({ title: currentValue ? "Annule" : "Fait !" })
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  // Marquer irrigation
  const marquerIrrigation = async (irrigationId: number) => {
    try {
      await fetch(`/api/irrigations/${irrigationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fait: true, dateEffective: new Date().toISOString() }),
      })
      setTaches((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          irrigation: prev.irrigation.filter((i) => i.id !== irrigationId),
          stats: { ...prev.stats, aIrriguer: prev.stats.aIrriguer - 1 },
        }
      })
      toast({ title: "Arrosage note !" })
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  const yearDiff = stats ? stats.recoltesAnnee - stats.recoltesAnneePrecedente : 0
  const yearDiffPercent = stats?.recoltesAnneePrecedente
    ? Math.round((yearDiff / stats.recoltesAnneePrecedente) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Mini-stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-green-100 text-xs">Cultures actives</CardDescription>
            <CardTitle className="text-2xl">
              {loadingStats ? "..." : stats?.culturesActives || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-green-100">sur {stats?.culturesTotal || 0} total</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-amber-100 text-xs">Surface cultivee</CardDescription>
            <CardTitle className="text-2xl">
              {loadingStats ? "..." : `${stats?.surfaceTotale || 0} m²`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-amber-100">{stats?.planches || 0} planches</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-blue-100 text-xs">Recoltes {year}</CardDescription>
            <CardTitle className="text-2xl">
              {loadingStats ? "..." : `${stats?.recoltesAnnee || 0} kg`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="flex items-center gap-1 text-xs">
              {yearDiff >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-200" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-200" />
              )}
              <span className={yearDiff >= 0 ? "text-green-200" : "text-red-200"}>
                {yearDiff >= 0 ? "+" : ""}
                {yearDiffPercent}% vs {year - 1}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Tâches résumé */}
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-purple-100 text-xs">Cette semaine</CardDescription>
            <CardTitle className="text-2xl">
              {loadingTaches
                ? "..."
                : taches
                  ? (taches.stats.semisPrevus - taches.stats.semisFaits) +
                    (taches.stats.plantationsPrevues - taches.stats.plantationsFaites) +
                    (taches.stats.recoltesPrevues - taches.stats.recoltesFaites) +
                    taches.stats.aIrriguer
                  : 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-purple-100">taches a faire</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendrier */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <Tabs
            value={calendarMode}
            onValueChange={(v) => setCalendarMode(v as "cultures" | "itps")}
          >
            <TabsList>
              <TabsTrigger value="cultures">Calendrier des cultures</TabsTrigger>
              <TabsTrigger value="itps">Calendrier des ITPs</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {calendarMode === "cultures" ? (
          <CalendarView year={year} />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Calendrier des ITPs</CardTitle>
              <p className="text-sm text-muted-foreground">
                Timeline annuelle des itineraires techniques
              </p>
            </CardHeader>
            <CardContent>
              <ItpCalendarView />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tâches de la semaine */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Taches de la semaine</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setWeekOffset(0)}
              className="text-sm font-medium hover:text-green-600 min-w-[140px] text-center"
            >
              {weekOffset === 0
                ? "Cette semaine"
                : weekOffset === 1
                  ? "Semaine prochaine"
                  : weekOffset === -1
                    ? "Semaine derniere"
                    : format(weekStart, "d MMM", { locale: fr }) +
                      " - " +
                      format(weekEnd, "d MMM", { locale: fr })}
            </button>
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loadingTaches ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : taches ? (
          <>
            {/* Résumé rapide */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-orange-50 rounded-lg p-2 text-center">
                <Sprout className="h-4 w-4 mx-auto text-orange-600 mb-1" />
                <p className="text-lg font-bold text-orange-700">
                  {taches.stats.semisPrevus - taches.stats.semisFaits}
                </p>
                <p className="text-xs text-orange-600">Semis</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <Leaf className="h-4 w-4 mx-auto text-green-600 mb-1" />
                <p className="text-lg font-bold text-green-700">
                  {taches.stats.plantationsPrevues - taches.stats.plantationsFaites}
                </p>
                <p className="text-xs text-green-600">Plantations</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-2 text-center">
                <Package className="h-4 w-4 mx-auto text-purple-600 mb-1" />
                <p className="text-lg font-bold text-purple-700">
                  {taches.stats.recoltesPrevues - taches.stats.recoltesFaites}
                </p>
                <p className="text-xs text-purple-600">Recoltes</p>
              </div>
              <div className="bg-cyan-50 rounded-lg p-2 text-center">
                <Droplets className="h-4 w-4 mx-auto text-cyan-600 mb-1" />
                <p className="text-lg font-bold text-cyan-700">{taches.stats.aIrriguer}</p>
                <p className="text-xs text-cyan-600">Arrosage</p>
              </div>
            </div>

            {/* Listes de tâches en grille */}
            <div className="grid gap-4 md:grid-cols-2">
              <TaskSection
                title="Semis a faire"
                icon={Sprout}
                iconColor="text-orange-600"
                items={taches.semis}
                type="semis"
                emptyText="Aucun semis cette semaine"
                onToggle={toggleTache}
              />
              <TaskSection
                title="Plantations"
                icon={Leaf}
                iconColor="text-green-600"
                items={taches.plantations}
                type="plantation"
                emptyText="Aucune plantation cette semaine"
                onToggle={toggleTache}
              />
              <TaskSection
                title="Recoltes"
                icon={Package}
                iconColor="text-purple-600"
                items={taches.recoltes}
                type="recolte"
                emptyText="Aucune recolte cette semaine"
                onToggle={toggleTache}
              />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Droplets className="h-5 w-5 text-cyan-600" />
                    A irriguer
                    {taches.irrigation.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">
                        {taches.irrigation.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {taches.irrigation.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Tout est arrose !</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {taches.irrigation.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => marquerIrrigation(item.id)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg border bg-white border-gray-200 hover:border-cyan-300 hover:shadow-sm transition-all text-left"
                        >
                          <Droplets className="h-4 w-4 text-cyan-600 flex-shrink-0" />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {item.couleur && (
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: item.couleur }}
                              />
                            )}
                            <span className="font-medium truncate text-sm">{item.especeId}</span>
                          </div>
                          {item.plancheId && (
                            <Badge variant="outline" className="flex-shrink-0 text-xs">
                              {item.plancheId}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

// Composant réutilisable pour une section de tâches
function TaskSection({
  title,
  icon: Icon,
  iconColor,
  items,
  type,
  emptyText,
  onToggle,
}: {
  title: string
  icon: React.ElementType
  iconColor: string
  items: TacheItem[]
  type: "semis" | "plantation" | "recolte"
  emptyText: string
  onToggle: (id: number, type: "semis" | "plantation" | "recolte", fait: boolean, especeId: string) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
          {items.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {items.filter((i) => !i.fait).length}/{items.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{emptyText}</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => onToggle(item.id, type, item.fait, item.especeId)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all text-left ${
                  item.fait
                    ? "bg-green-50 border-green-200 opacity-60"
                    : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                }`}
              >
                {item.fait ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-300 flex-shrink-0" />
                )}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {item.couleur && (
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.couleur }}
                    />
                  )}
                  <span className={`font-medium truncate text-sm ${item.fait ? "line-through" : ""}`}>
                    {item.especeId}
                  </span>
                  {item.varieteId && (
                    <span className="text-xs text-muted-foreground truncate">{item.varieteId}</span>
                  )}
                </div>
                {item.plancheId && (
                  <Badge variant="outline" className="flex-shrink-0 text-xs">
                    {item.plancheId}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
