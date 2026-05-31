"use client"

/**
 * Page Taches du jour - Vue mobile-friendly pour le travail au champ
 * Affiche les taches urgentes avec actions rapides
 */

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Sprout,
  Leaf,
  Package,
  Droplets,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns"
import { fr } from "date-fns/locale"

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

function TachesContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [data, setData] = React.useState<TachesData | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [weekOffset, setWeekOffset] = React.useState(0)

  // Calculer la semaine courante - mémoriser pour éviter les boucles infinies
  const { currentDate, weekStart, weekEnd } = React.useMemo(() => {
    const base = new Date()
    const current = addWeeks(base, weekOffset)
    return {
      currentDate: current,
      weekStart: startOfWeek(current, { weekStartsOn: 1 }),
      weekEnd: endOfWeek(current, { weekStartsOn: 1 }),
    }
  }, [weekOffset])

  // Créer les strings ISO une seule fois pour éviter les re-renders
  const startIso = React.useMemo(() => weekStart.toISOString(), [weekStart])
  const endIso = React.useMemo(() => weekEnd.toISOString(), [weekEnd])

  // Bug #6 (testeur) — Regroupe les irrigations par espèce pour éviter une
  // longue liste de lignes quasi identiques (« 20× Tomate »). On conserve
  // chaque planche en sous-ligne actionnable, mais sous un en-tête « ×N ».
  const groupedIrrigation = React.useMemo(() => {
    const groups = new Map<string, { especeId: string; couleur: string | null; items: IrrigationItem[] }>()
    for (const item of data?.irrigation ?? []) {
      const existing = groups.get(item.especeId)
      if (existing) {
        existing.items.push(item)
      } else {
        groups.set(item.especeId, { especeId: item.especeId, couleur: item.couleur, items: [item] })
      }
    }
    // Trie les sous-lignes par date prévue, puis les groupes par taille décroissante.
    const arr = Array.from(groups.values())
    arr.forEach(g => g.items.sort((a, b) => new Date(a.datePrevue).getTime() - new Date(b.datePrevue).getTime()))
    return arr.sort((a, b) => b.items.length - a.items.length || a.especeId.localeCompare(b.especeId))
  }, [data?.irrigation])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/taches?start=${startIso}&end=${endIso}`
      )
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      setData(result)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les taches",
      })
    } finally {
      setIsLoading(false)
    }
  }, [startIso, endIso, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Marquer une tache comme faite
  const toggleTache = async (cultureId: number, type: "semis" | "plantation" | "recolte", currentValue: boolean, especeId: string) => {
    // Pour les recoltes, demander la quantité
    if (type === "recolte" && !currentValue) {
      const quantiteStr = prompt("Quantité récoltée (kg) :")
      if (!quantiteStr) return

      const quantite = parseFloat(quantiteStr)
      if (isNaN(quantite) || quantite <= 0) {
        toast({ variant: "destructive", title: "Quantité invalide" })
        return
      }

      try {
        // Créer la recolte
        await fetch("/api/recoltes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cultureId,
            especeId,
            date: new Date().toISOString(),
            quantite,
          }),
        })

        // Marquer comme fait
        await fetch(`/api/cultures/${cultureId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recolteFaite: true }),
        })

        toast({ title: "Récolte enregistrée", description: `${quantite} kg` })
        fetchData() // Recharger
      } catch (error) {
        toast({ variant: "destructive", title: "Erreur" })
      }
      return
    }

    // Pour les autres (semis, plantation, annuler recolte)
    try {
      const fieldMap = {
        semis: "semisFait",
        plantation: "plantationFaite",
        recolte: "recolteFaite",
      }
      const field = fieldMap[type]

      const response = await fetch(`/api/cultures/${cultureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !currentValue }),
      })
      if (!response.ok) throw new Error("Erreur")

      // Mettre a jour localement
      setData(prev => {
        if (!prev) return prev
        const key = type === "semis" ? "semis" : type === "plantation" ? "plantations" : "recoltes"
        return {
          ...prev,
          [key]: prev[key].map(t =>
            t.id === cultureId ? { ...t, fait: !currentValue } : t
          ),
          stats: {
            ...prev.stats,
            [`${type}sFaits`]: prev.stats[`${type}sFaits` as keyof typeof prev.stats] + (currentValue ? -1 : 1),
          },
        }
      })

      toast({
        title: currentValue ? "Annule" : "Fait !",
        description: `${type} ${currentValue ? "a refaire" : "termine"}`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre a jour",
      })
    }
  }

  // Marquer irrigation planifiée comme faite
  const marquerIrrigation = async (irrigationId: number) => {
    // Demander si quantité différente du prévu
    const noteStr = prompt(
      "Notes sur l'arrosage ?\n(ex: \"Plus que prévu\", \"Sol sec\", \"Pluie\" ou laissez vide)"
    )

    try {
      const response = await fetch(`/api/irrigations/${irrigationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fait: true,
          dateEffective: new Date().toISOString(),
          notes: noteStr || null,
        }),
      })
      if (!response.ok) throw new Error("Erreur")

      // Retirer de la liste
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          irrigation: prev.irrigation.filter(i => i.id !== irrigationId),
          stats: { ...prev.stats, aIrriguer: prev.stats.aIrriguer - 1 },
        }
      })

      toast({
        title: "Arrosage noté !",
        description: noteStr || "Irrigation standard",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de noter l'arrosage",
      })
    }
  }

  const TaskCard = ({
    title,
    icon: Icon,
    iconColor,
    items,
    type,
    emptyText,
  }: {
    title: string
    icon: React.ElementType
    iconColor: string
    items: TacheItem[]
    type: "semis" | "plantation" | "recolte"
    emptyText: string
  }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
          {items.length > 0 && (() => {
            // BUG #17 (audit Marc 2026-05-15) : « Semis à faire 0/1 Haricot
            // vert barré » — ambigu. L'éleveur lit « 0 sur 1 » comme s'il
            // restait des choses à faire alors qu'avec 0/1 + barré, tout est
            // fait. On bascule en « N restant(s) / total » (plus universel),
            // et on affiche « Tout fait ✓ » quand 0 restant.
            const restants = items.filter(i => !i.fait).length
            return (
              <Badge
                variant={restants === 0 ? 'default' : 'secondary'}
                className={`ml-auto ${restants === 0 ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}`}
              >
                {restants === 0 ? `Tout fait ✓ (${items.length})` : `${restants} restant${restants > 1 ? 's' : ''} / ${items.length}`}
              </Badge>
            )
          })()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{emptyText}</p>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => toggleTache(item.id, type, item.fait, item.especeId)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  item.fait
                    ? "bg-green-50 border-green-200 opacity-60"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                {item.fait ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300 flex-shrink-0" />
                )}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {item.couleur && (
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.couleur }}
                    />
                  )}
                  <span className={`font-medium truncate ${item.fait ? "line-through" : ""}`}>
                    {item.especeId}
                  </span>
                  {item.varieteId && (
                    <span className="text-sm text-muted-foreground truncate">
                      {item.varieteId}
                    </span>
                  )}
                </div>
                {item.plancheId && (
                  <Badge variant="outline" className="flex-shrink-0">
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-64 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header compact pour mobile */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-lg font-bold">Taches</h1>
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation semaine */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(o => o - 1)}
              className="h-8 px-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <button
                onClick={() => setWeekOffset(0)}
                className="text-sm font-medium hover:text-green-600"
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
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(o => o + 1)}
              className="h-8 px-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="p-4 space-y-4 pb-20">
        {/* Resume rapide */}
        {data && (
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-orange-50 rounded-lg p-2 text-center">
              <Sprout className="h-4 w-4 mx-auto text-orange-600 mb-1" />
              <p className="text-lg font-bold text-orange-700">
                {data.stats.semisPrevus - data.stats.semisFaits}
              </p>
              <p className="text-xs text-orange-600">Semis</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <Leaf className="h-4 w-4 mx-auto text-green-600 mb-1" />
              <p className="text-lg font-bold text-green-700">
                {data.stats.plantationsPrevues - data.stats.plantationsFaites}
              </p>
              <p className="text-xs text-green-600">Plantations</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-2 text-center">
              <Package className="h-4 w-4 mx-auto text-purple-600 mb-1" />
              <p className="text-lg font-bold text-purple-700">
                {data.stats.recoltesPrevues - data.stats.recoltesFaites}
              </p>
              <p className="text-xs text-purple-600">Récoltes</p>
            </div>
            <div className="bg-cyan-50 rounded-lg p-2 text-center">
              <Droplets className="h-4 w-4 mx-auto text-cyan-600 mb-1" />
              <p className="text-lg font-bold text-cyan-700">{data.stats.aIrriguer}</p>
              <p className="text-xs text-cyan-600">Arrosage</p>
            </div>
          </div>
        )}

        {/* Sections de taches */}
        {data && (
          <>
            <TaskCard
              title="Semis à faire"
              icon={Sprout}
              iconColor="text-orange-600"
              items={data.semis}
              type="semis"
              emptyText="Aucun semis prévu cette semaine"
            />

            <TaskCard
              title="Plantations"
              icon={Leaf}
              iconColor="text-green-600"
              items={data.plantations}
              type="plantation"
              emptyText="Aucune plantation prévue cette semaine"
            />

            <TaskCard
              title="Récoltes"
              icon={Package}
              iconColor="text-purple-600"
              items={data.recoltes}
              type="recolte"
              emptyText="Aucune récolte prévue cette semaine"
            />

            {/* Irrigation */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Droplets className="h-5 w-5 text-cyan-600" />
                  À irriguer
                  {data.irrigation.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {data.irrigation.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.irrigation.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Tout est arrose !
                  </p>
                ) : (
                  // Bug #6 (testeur) — Regroupement par espèce : avant, 20 cultures
                  // de Tomate produisaient 20 lignes quasi identiques. On affiche
                  // désormais un en-tête « Tomate ×4 » (nombre de planches) suivi
                  // des lignes par planche, individuellement actionnables.
                  <div className="space-y-3">
                    {groupedIrrigation.map(groupe => (
                      <div key={groupe.especeId} className="space-y-1.5">
                        <div className="flex items-center gap-2 px-1">
                          {groupe.couleur && (
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: groupe.couleur }}
                            />
                          )}
                          <span className="font-semibold text-sm">{groupe.especeId}</span>
                          {groupe.items.length > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              ×{groupe.items.length}
                            </Badge>
                          )}
                        </div>
                        {groupe.items.map(item => {
                          const datePrevue = new Date(item.datePrevue)
                          const isToday = datePrevue.toDateString() === new Date().toDateString()
                          const isPast = datePrevue < new Date() && !isToday

                          return (
                            <button
                              key={item.id}
                              onClick={() => marquerIrrigation(item.id)}
                              className={`w-full flex items-center gap-3 p-2.5 pl-5 rounded-lg border bg-white transition-all ${
                                isPast ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-cyan-300 hover:shadow-sm'
                              }`}
                            >
                              <Droplets className={`h-4 w-4 flex-shrink-0 ${
                                isPast ? 'text-red-600' : isToday ? 'text-cyan-600' : 'text-blue-500'
                              }`} />
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-sm text-muted-foreground truncate">
                                  {item.plancheId || 'Sans planche'}
                                </span>
                              </div>
                              <span className={`text-sm ${
                                isPast ? 'text-red-600 font-medium' : isToday ? 'text-cyan-600' : 'text-blue-500'
                              }`}>
                                {isToday ? "Aujourd'hui" : format(datePrevue, "EEE d", { locale: fr })}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

export default function TachesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <TachesContent />
    </Suspense>
  )
}
