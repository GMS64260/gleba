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
  AlertTriangle,
  CloudRain,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { BulkActions } from "@/components/calendrier/BulkActions"
import { CalendarView } from "@/components/dashboard/CalendarView"
import { ItpCalendarView } from "@/components/dashboard/ItpCalendarView"
import { IrrigationAdvisor } from "@/components/meteo"
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns"
import { fr } from "date-fns/locale"

interface DashboardStats {
  culturesActives: number
  culturesTotal: number
  planches: number
  // surfaceTotale = surface cultivée (compatibilité ancien champ)
  surfaceTotale: number
  surfaceCultivee?: number
  surfacePlanifiee?: number
  recoltesAnnee: number
  // YTD vs YTD année dernière à date égale (cf. src/lib/kpi).
  recoltesAnneePrecedente: number
  recoltesAnneePrecedenteTotal?: number
  comparisonMode?: string
  // Bug #3 — projection unifiée avec PlanificationTab.
  recoltesRealiseesKg?: number
  recoltesProjectionKg?: number
  recoltesTotalAttenduKg?: number
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
  retardJours: number
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
  retardJours: number
  pluiePrevue: number | null
  probablementInutile: boolean
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
    enRetard: number
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
  // QA Camille 2026-05-15 — Bug #2 : on inclut `year` pour que l'API
  // filtre les cultures concernées sur l'année sélectionnée
  // (sinon les tâches restent figées sur l'année courante).
  const fetchTaches = React.useCallback(async () => {
    setLoadingTaches(true)
    try {
      const res = await fetch(
        `/api/taches?year=${year}&start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`
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
  }, [year, weekStart, weekEnd])

  React.useEffect(() => {
    fetchTaches()
  }, [fetchTaches])

  // Auto-générer les irrigations si aucune n'existe (une seule fois par session)
  const [irrigationsGenerated, setIrrigationsGenerated] = React.useState(false)
  React.useEffect(() => {
    if (irrigationsGenerated || !taches || loadingTaches) return
    // Si 0 irrigations et qu'il y a des cultures actives, générer automatiquement
    if (taches.irrigation.length === 0 && taches.stats.semisPrevus + taches.stats.plantationsPrevues > 0) {
      setIrrigationsGenerated(true)
      fetch('/api/irrigations/generate', { method: 'POST' })
        .then(r => r.json())
        .then(result => {
          if (result.created > 0) {
            // Recharger les tâches avec les nouvelles irrigations
            fetchTaches()
          }
        })
        .catch(() => {})
    }
  }, [taches, loadingTaches, irrigationsGenerated, fetchTaches])

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
        toast({ title: "Récolte enregistrée", description: `${quantite} kg` })
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

  // PROMPT 20a — Bulk "Tout fait" pour semis ou plantation (récolte exclu : qty manuelle)
  const bulkDoneTaches = async (type: "semis" | "plantation" | "recolte") => {
    if (!taches || type === "recolte") return
    const key = type === "semis" ? "semis" : "plantations"
    const ids = taches[key].filter((t) => !t.fait).map((t) => t.id)
    if (ids.length === 0) return
    // Optimistic update
    setTaches((prev) => {
      if (!prev) return prev
      return { ...prev, [key]: prev[key].map((t) => (ids.includes(t.id) ? { ...t, fait: true } : t)) }
    })
    try {
      const res = await fetch("/api/cultures/bulk-fait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, type }),
      })
      if (!res.ok) throw new Error("Échec")
      toast({ title: `${ids.length} tâche${ids.length > 1 ? "s" : ""} marquée${ids.length > 1 ? "s" : ""} comme faite${ids.length > 1 ? "s" : ""}` })
    } catch {
      toast({ variant: "destructive", title: "Erreur, recharge en cours" })
      fetchTaches()
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
  // Bug #26 — Ne pas afficher "+0% vs N-1" si la donnée N-1 n'existe pas ou
  // est trop faible (< 5 kg → 1 cagette, statistiquement non significatif).
  // Bug cmp8sitxl (Marc 2026-05-16) — seuil 5kg trop strict (95% des
  // micro-fermes en début de saison avaient "Pas de comparatif"). On bascule
  // sur >0 kg N-1 (sinon la comparaison n'a aucun sens), et on supprime le
  // "-100%" affolant quand l'année en cours n'a pas encore démarré : on
  // affiche plutôt "Saison à venir" + référence absolue.
  // Bug feedback testeur 2026-05-25 (cmplkaazg) — sur l'année courante
  // avec récoltes (N=85kg) mais N-1=0, on disait "Pas de comparatif" alors
  // que c'était la première année avec activité. On distingue désormais 3
  // cas: première année (N>0, N-1=0), saison à venir (N=0, N-1>0), comparatif
  // disponible (les deux > 0).
  const recoltesN = stats?.recoltesAnnee ?? 0
  const recoltesN1 = stats?.recoltesAnneePrecedente ?? 0
  const hasComparatifN1 = recoltesN1 > 0 && recoltesN > 0
  const aucuneRecolteN = recoltesN === 0 && recoltesN1 > 0
  const premiereAnnee = recoltesN > 0 && recoltesN1 === 0

  return (
    <div className="space-y-6">
      {/* Mini-stats */}
      <TooltipProvider delayDuration={150}>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardHeader className="pb-1 pt-3 px-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardDescription className="text-emerald-100 text-xs flex items-center gap-1 cursor-help">
                    Cultures actives
                    <Info className="h-3 w-3 opacity-80" />
                  </CardDescription>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-left">
                  <p className="font-semibold mb-1">Cultures actives</p>
                  <p className="text-xs leading-relaxed">
                    Cultures actuellement en cours sur vos planches (semées ou plantées, pas
                    encore arrachées). Permet de visualiser l&apos;activité réelle du jardin
                    par rapport au total enregistré sur l&apos;annee.
                  </p>
                </TooltipContent>
              </Tooltip>
              <CardTitle className="text-2xl">
                {loadingStats ? "..." : stats?.culturesActives || 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              {/* Bug cmp8skl7r (Marc 2026-05-16) — Cultures actives 15 sur
                  19 total prêtait à confusion avec "19 cultures prévues" en
                  Planification. On précise le statut des 4 inactives :
                  planifiées non démarrées ou terminées. */}
              {(() => {
                const total = stats?.culturesTotal || 0
                const actives = stats?.culturesActives || 0
                const delta = Math.max(0, total - actives)
                if (delta === 0) {
                  return <p className="text-xs text-emerald-100">sur {total} planifiée{total > 1 ? 's' : ''}</p>
                }
                return (
                  <p className="text-xs text-emerald-100">
                    sur {total} planifiées · {delta} non démarrée{delta > 1 ? 's' : ''}/terminée{delta > 1 ? 's' : ''}
                  </p>
                )
              })()}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-700 to-slate-800 text-white">
            <CardHeader className="pb-1 pt-3 px-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardDescription className="text-slate-300 text-xs flex items-center gap-1 cursor-help">
                    Surface cultivée
                    <Info className="h-3 w-3 opacity-80" />
                  </CardDescription>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-left">
                  <p className="font-semibold mb-1">Surface cultivée</p>
                  <p className="text-xs leading-relaxed">
                    Somme des surfaces (longueur × largeur) des planches portant actuellement
                    une culture active. À comparer avec votre surface totale disponible pour
                    estimer le taux d&apos;occupation du jardin.
                  </p>
                </TooltipContent>
              </Tooltip>
              <CardTitle className="text-2xl">
                {loadingStats
                  ? "..."
                  : `${stats?.surfaceCultivee ?? stats?.surfaceTotale ?? 0} m²`}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              {stats?.surfacePlanifiee !== undefined &&
              stats.surfacePlanifiee !== (stats.surfaceCultivee ?? stats.surfaceTotale) ? (
                <p className="text-xs text-slate-300">
                  / Planifiée {stats.surfacePlanifiee} m² · {stats.planches} planches
                </p>
              ) : (
                <p className="text-xs text-slate-300">{stats?.planches || 0} planches</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-600 to-amber-700 text-white">
            <CardHeader className="pb-1 pt-3 px-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardDescription className="text-amber-100 text-xs flex items-center gap-1 cursor-help">
                    Récoltes {year}
                    <Info className="h-3 w-3 opacity-80" />
                  </CardDescription>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-left">
                  <p className="font-semibold mb-1">Récoltes de l&apos;année</p>
                  <p className="text-xs leading-relaxed">
                    Cumul (en kg) de toutes les recoltes enregistrées entre le 1<sup>er</sup> janvier
                    et aujourd&apos;hui. La comparaison vs N-1 indique si la saison est meilleure
                    ou moins bonne que l&apos;an dernier à la même date.
                  </p>
                </TooltipContent>
              </Tooltip>
              <CardTitle className="text-2xl">
                {loadingStats ? "..." : `${stats?.recoltesAnnee || 0} kg`}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              {/* Bug #3 — afficher le prévisionnel restant pour éviter
                  l'impression que les 85 kg = total de l'année (le bloc
                  Planification annonçait 1367 kg attendus). */}
              {(stats?.recoltesProjectionKg ?? 0) > 0 && (
                <p className="text-[11px] text-amber-100 mb-0.5">
                  + {stats?.recoltesProjectionKg?.toFixed(1)} kg à venir
                  {stats?.recoltesTotalAttenduKg
                    ? ` (total attendu ${stats.recoltesTotalAttenduKg.toFixed(1)} kg)`
                    : ""}
                </p>
              )}
              {aucuneRecolteN ? (
                <p className="text-[10px] text-amber-100 italic">
                  Saison à venir (N-1 : {stats?.recoltesAnneePrecedente?.toFixed(1)} kg)
                </p>
              ) : premiereAnnee ? (
                <p className="text-[10px] text-amber-100 italic">
                  Première année avec activité (N-1 = 0 kg)
                </p>
              ) : hasComparatifN1 ? (
                <>
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
                  <p className="text-[10px] text-amber-100 mt-0.5">
                    (YTD vs YTD année dernière)
                  </p>
                </>
              ) : (
                <p className="text-[10px] text-amber-100 italic">
                  Pas de comparatif N-1 disponible
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tâches résumé */}
          <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white">
            <CardHeader className="pb-1 pt-3 px-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardDescription className="text-teal-100 text-xs flex items-center gap-1 cursor-help">
                    Cette semaine
                    <Info className="h-3 w-3 opacity-80" />
                  </CardDescription>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-left">
                  <p className="font-semibold mb-1">Tâches de la semaine</p>
                  <p className="text-xs leading-relaxed">
                    Total des semis, plantations, recoltes et arrosages à faire entre lundi
                    et dimanche de la semaine en cours. Les tâches « en retard » correspondent
                    à des actions prevues les semaines passées et toujours non cochées.
                  </p>
                </TooltipContent>
              </Tooltip>
              <CardTitle className="text-2xl">
                {loadingTaches
                  ? "..."
                  : taches
                    ? (taches.stats.semisPrevus - taches.stats.semisFaits) +
                      (taches.stats.plantationsPrevues - taches.stats.plantationsFaites) +
                      (taches.stats.recoltesPrevues - taches.stats.recoltesFaites) +
                      taches.irrigation.filter(i => !i.probablementInutile).length
                    : 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              {taches && taches.stats.enRetard > 0 ? (
                <p className="text-xs text-red-200 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  dont {taches.stats.enRetard} en retard
                </p>
              ) : (
                <p className="text-xs text-teal-100">tâches à faire</p>
              )}
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* Irrigation — bug feedback testeur 2026-05-25 (cmplk9r2d) :
          les conseils irrigation se basent sur les cultures actives
          (terminee=null), donc ils n'ont de sens que sur l'année en
          cours. Sur 2024/2025/2027, on masque le bloc plutôt que
          d'afficher les mêmes cultures urgentes à tort. */}
      {year === new Date().getFullYear() ? (
        <IrrigationAdvisor />
      ) : (
        <div className="border rounded-lg p-4 bg-slate-50 text-sm text-slate-600">
          Les conseils d&apos;irrigation sont calculés sur les cultures actives à
          ce jour. Pour les consulter, sélectionnez l&apos;année en cours.
        </div>
      )}

      {/* Calendrier */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          {/* Bug feedback testeur 2026-05-25 — l'onglet "Calendrier des ITPs"
              restait inerte avec le composant Tabs (probable conflit de
              focus/event-bubbling). On remplace par un toggle button-group
              explicite qui appelle setCalendarMode directement. */}
          <div role="tablist" className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
            <button
              type="button"
              role="tab"
              aria-selected={calendarMode === "cultures"}
              onClick={() => setCalendarMode("cultures")}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all ${calendarMode === "cultures" ? "bg-background text-foreground shadow" : "hover:bg-background/50"}`}
            >
              Calendrier des cultures
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={calendarMode === "itps"}
              onClick={() => setCalendarMode("itps")}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all ${calendarMode === "itps" ? "bg-background text-foreground shadow" : "hover:bg-background/50"}`}
            >
              Calendrier des ITPs
            </button>
          </div>
        </div>
        {calendarMode === "cultures" ? (
          <CalendarView year={year} />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Calendrier des ITPs</CardTitle>
              <p className="text-sm text-muted-foreground">
                Timeline annuelle des itinéraires techniques
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold">Tâches de la semaine</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setWeekOffset(0)}
              className="text-sm font-medium hover:text-green-600 min-w-[120px] sm:min-w-[140px] text-center"
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
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
                <p className="text-xs text-purple-600">Récoltes</p>
              </div>
              <div className="bg-cyan-50 rounded-lg p-2 text-center">
                <Droplets className="h-4 w-4 mx-auto text-cyan-600 mb-1" />
                <p className="text-lg font-bold text-cyan-700">
                  {taches.irrigation.filter(i => !i.probablementInutile).length}
                </p>
                <p className="text-xs text-cyan-600">
                  Arrosage
                  {taches.irrigation.filter(i => i.probablementInutile).length > 0 && (
                    <span className="text-blue-500 ml-1">
                      ({taches.irrigation.filter(i => i.probablementInutile).length} annule{taches.irrigation.filter(i => i.probablementInutile).length > 1 ? "s" : ""} pluie)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Listes de tâches en grille */}
            <div className="grid gap-4 md:grid-cols-2">
              <TaskSection
                title="Semis à faire"
                icon={Sprout}
                iconColor="text-orange-600"
                items={taches.semis}
                type="semis"
                emptyText="Aucun semis cette semaine"
                onToggle={toggleTache}
                onBulkDone={bulkDoneTaches}
              />
              <TaskSection
                title="Plantations"
                icon={Leaf}
                iconColor="text-green-600"
                items={taches.plantations}
                type="plantation"
                emptyText="Aucune plantation cette semaine"
                onToggle={toggleTache}
                onBulkDone={bulkDoneTaches}
              />
              <TaskSection
                title="Récoltes"
                icon={Package}
                iconColor="text-purple-600"
                items={taches.recoltes}
                type="recolte"
                emptyText="Aucune récolte cette semaine"
                onToggle={toggleTache}
              />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Droplets className="h-5 w-5 text-cyan-600" />
                    A irriguer
                    <div className="flex items-center gap-1.5 ml-auto">
                      {taches.irrigation.filter(i => i.retardJours > 0).length > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          {taches.irrigation.filter(i => i.retardJours > 0).length} en retard
                        </Badge>
                      )}
                      {taches.irrigation.filter(i => i.probablementInutile).length > 0 && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-600 hover:bg-blue-100">
                          <CloudRain className="h-3 w-3 mr-0.5" />
                          {taches.irrigation.filter(i => i.probablementInutile).length}
                        </Badge>
                      )}
                      {taches.irrigation.length > 0 && (
                        <Badge variant="secondary">
                          {taches.irrigation.filter(i => !i.probablementInutile).length}/{taches.irrigation.length}
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {taches.irrigation.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Tout est arrosé !</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {taches.irrigation.map((item) => {
                        const isRetard = item.retardJours > 0
                        const inutile = item.probablementInutile && !isRetard
                        return (
                          <button
                            key={item.id}
                            onClick={() => marquerIrrigation(item.id)}
                            className={`w-full flex flex-col gap-1 p-2 rounded-lg border transition-all text-left ${
                              inutile
                                ? "bg-blue-50/60 border-blue-200/60 opacity-70 hover:opacity-90 hover:shadow-sm"
                                : isRetard
                                  ? "bg-red-50 border-red-200 hover:border-red-300 hover:shadow-sm"
                                  : "bg-white border-slate-200 hover:border-cyan-300 hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {inutile ? (
                                <CloudRain className="h-4 w-4 text-blue-400 flex-shrink-0" />
                              ) : isRetard ? (
                                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                              ) : (
                                <Droplets className="h-4 w-4 text-cyan-600 flex-shrink-0" />
                              )}
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {item.couleur && (
                                  <div
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: item.couleur }}
                                  />
                                )}
                                <span className={`font-medium truncate text-sm ${inutile ? "line-through text-muted-foreground" : ""}`}>
                                  {item.especeId}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isRetard && (
                                  <span className="text-[10px] font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                    {retardLabel(item.retardJours)}
                                  </span>
                                )}
                                {item.plancheId && (
                                  <Badge variant="outline" className={`text-xs ${inutile ? "opacity-60" : ""}`}>
                                    {item.plancheId}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {inutile && item.pluiePrevue != null && (
                              <p className="text-[11px] text-blue-500 pl-7">
                                {Math.round(item.pluiePrevue)}mm de pluie prévue — irrigation probablement inutile
                              </p>
                            )}
                          </button>
                        )
                      })}
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

function retardLabel(jours: number): string {
  if (jours <= 0) return ''
  const semaines = Math.floor(jours / 7)
  if (semaines < 1) return `${jours}j de retard`
  if (semaines === 1) return '1 sem. de retard'
  return `${semaines} sem. de retard`
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
  onBulkDone,
}: {
  title: string
  icon: React.ElementType
  iconColor: string
  items: TacheItem[]
  type: "semis" | "plantation" | "recolte"
  emptyText: string
  onToggle: (id: number, type: "semis" | "plantation" | "recolte", fait: boolean, especeId: string) => void
  onBulkDone?: (type: "semis" | "plantation" | "recolte") => void | Promise<void>
}) {
  const enRetardCount = items.filter(i => i.retardJours > 0 && !i.fait).length
  const aFaireCount = items.filter(i => !i.fait).length
  // Feedback Marc 2026-05-16 — V2 Bug 7 : afficher "fait/total" plutôt
  // que "à faire/total" (Haricot vert coché donnait 0/1, l'utilisateur
  // lisait "0 fait sur 1" alors qu'il était fait → maintenant 1/1).
  const faitCount = items.length - aFaireCount

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
          <div className="flex items-center gap-1.5 ml-auto">
            {enRetardCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {enRetardCount} en retard
              </Badge>
            )}
            {items.length > 0 && (
              <Badge variant="secondary" title="Tâches faites / total">
                {faitCount}/{items.length}
              </Badge>
            )}
            {/* PROMPT 20a — bouton "Tout fait" sur semis/plantation seulement
                (la récolte requiert saisie quantité, traitée individuellement) */}
            {type !== "recolte" && aFaireCount >= 2 && onBulkDone && (
              <BulkActions count={aFaireCount} onMarkAllDone={() => onBulkDone(type)} reportEnabled={false} />
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{emptyText}</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {items.map((item) => {
              const isRetard = item.retardJours > 0 && !item.fait
              return (
                <button
                  key={`${item.id}-${item.retardJours}`}
                  onClick={() => onToggle(item.id, type, item.fait, item.especeId)}
                  className={`w-full p-2 rounded-lg border transition-all text-left ${
                    item.fait
                      ? "bg-green-50 border-green-200 opacity-60"
                      : isRetard
                        ? "bg-red-50 border-red-200 hover:border-red-300 hover:shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.fait ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : isRetard ? (
                      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-300 flex-shrink-0" />
                    )}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
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
                        <span className="text-xs text-muted-foreground truncate hidden sm:inline">{item.varieteId}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isRetard && (
                        <span className="text-[10px] font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {retardLabel(item.retardJours)}
                        </span>
                      )}
                      {item.plancheId && (
                        <Badge variant="outline" className="text-[10px] sm:text-xs max-w-[80px] sm:max-w-none truncate">
                          {item.plancheId}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Variété visible sur mobile sous le nom */}
                  {item.varieteId && (
                    <p className="text-[11px] text-muted-foreground truncate pl-6 mt-0.5 sm:hidden">{item.varieteId}</p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
