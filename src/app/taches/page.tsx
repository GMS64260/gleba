"use client"

/**
 * Page Taches du jour - Vue mobile-friendly pour le travail au champ
 * Affiche les taches urgentes avec actions rapides
 */

import * as React from "react"
import Link from "next/link"
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
  AlertTriangle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns"
import { fr } from "date-fns/locale"

interface TacheItem {
  id: number
  type: "semis" | "plantation" | "recolte"
  especeId: string
  especeNom?: string
  varieteId: string | null
  varieteNom?: string | null
  plancheId: string | null
  date: string
  fait: boolean
  couleur: string | null
}

interface IrrigationItem {
  id: number
  cultureId: number
  especeId: string
  especeNom?: string
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
  const { toast } = useToast()
  const [data, setData] = React.useState<TachesData | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [weekOffset, setWeekOffset] = React.useState(0)
  const [pendingAction, setPendingAction] = React.useState<
    | { kind: "recolte"; cultureId: number; especeId: string; label: string }
    | { kind: "annulation-recolte"; cultureId: number; especeId: string; label: string }
    | { kind: "irrigation"; irrigationId: number; label: string }
    | null
  >(null)
  const [actionValue, setActionValue] = React.useState("")
  const [actionLoading, setActionLoading] = React.useState(false)

  // Calculer la semaine courante - mémoriser pour éviter les boucles infinies
  const { weekStart, weekEnd } = React.useMemo(() => {
    const base = new Date()
    const current = addWeeks(base, weekOffset)
    return {
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
    const groups = new Map<string, { especeId: string; especeNom?: string; couleur: string | null; items: IrrigationItem[] }>()
    for (const item of data?.irrigation ?? []) {
      const existing = groups.get(item.especeId)
      if (existing) {
        existing.items.push(item)
      } else {
        groups.set(item.especeId, { especeId: item.especeId, especeNom: item.especeNom, couleur: item.couleur, items: [item] })
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
    } catch {
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
  const toggleTache = async (cultureId: number, type: "semis" | "plantation" | "recolte", currentValue: boolean, especeId: string, label: string) => {
    if (type === "recolte" && !currentValue) {
      setActionValue("")
      setPendingAction({ kind: "recolte", cultureId, especeId, label })
      return
    }

    if (type === "recolte" && currentValue) {
      setActionValue("")
      setPendingAction({ kind: "annulation-recolte", cultureId, especeId, label })
      return
    }

    await updateSimpleTache(cultureId, type, currentValue)
  }

  const enregistrerRecolte = async (cultureId: number, especeId: string) => {
      const quantiteStr = actionValue

      // Accepte la virgule décimale française ("2,5" → 2.5) — parseFloat seul
      // tronquait à 2 (audit 2026-07, #47).
      const quantite = parseFloat(quantiteStr.replace(",", ".").trim())
      if (isNaN(quantite) || quantite <= 0) {
        toast({ variant: "destructive", title: "Quantité invalide" })
        return
      }

      setActionLoading(true)
      try {
        // Créer la recolte — on vérifie le succès avant de marquer "fait"
        // et d'afficher la confirmation (sinon faux succès, audit #32).
        const recolteRes = await fetch("/api/recoltes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cultureId,
            especeId,
            date: new Date().toISOString(),
            quantite,
          }),
        })
        if (!recolteRes.ok) {
          const p = await recolteRes.json().catch(() => null)
          toast({ variant: "destructive", title: "Erreur", description: p?.error || "La récolte n'a pas pu être enregistrée." })
          return
        }

        // Marquer comme fait
        const patchRes = await fetch(`/api/cultures/${cultureId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recolteFaite: true }),
        })
        if (!patchRes.ok) {
          toast({ variant: "destructive", title: "Récolte enregistrée mais statut non mis à jour", description: "Rafraîchissez la page." })
          fetchData()
          return
        }

        toast({ title: "Récolte enregistrée", description: `${quantite} kg` })
        setPendingAction(null)
        fetchData() // Recharger
      } catch {
        toast({ variant: "destructive", title: "Erreur" })
      } finally {
        setActionLoading(false)
      }
  }

    // Décochage d'une récolte : supprimer la/les récolte(s) en stock créée(s)
    // par le pointage, sinon elles restaient comptées dans le stock et un
    // recochage en créait une seconde → double comptage (audit 2026-07, #81).
  const annulerRecolte = async (cultureId: number) => {
      setActionLoading(true)
      try {
        const res = await fetch(`/api/recoltes?cultureId=${cultureId}&pageSize=200`)
        if (res.ok) {
          const payload = await res.json()
          const rows: Array<{ id: number; statut: string }> = Array.isArray(payload) ? payload : payload.data || []
          await Promise.all(
            rows.filter(r => r.statut === "en_stock").map(r =>
              fetch(`/api/recoltes/${r.id}`, { method: "DELETE" })
            )
          )
        }
        const patch = await fetch(`/api/cultures/${cultureId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recolteFaite: false }),
        })
        if (!patch.ok) throw new Error("Erreur")
        toast({ title: "Récolte annulée" })
        setPendingAction(null)
        fetchData()
      } catch {
        toast({ variant: "destructive", title: "Erreur" })
      } finally {
        setActionLoading(false)
      }
  }

  const updateSimpleTache = async (cultureId: number, type: "semis" | "plantation" | "recolte", currentValue: boolean) => {
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
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre a jour",
      })
    }
  }

  // Marquer irrigation planifiée comme faite
  const marquerIrrigation = async (irrigationId: number) => {
    const noteStr = actionValue.trim()
    setActionLoading(true)
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
      setPendingAction(null)
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de noter l'arrosage",
      })
    } finally {
      setActionLoading(false)
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
    icon: React.ComponentType<{ className?: string }>
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
                onClick={() => toggleTache(item.id, type, item.fait, item.especeId, item.especeNom ?? item.especeId)}
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
                    {item.especeNom ?? item.especeId}
                  </span>
                  {item.varieteId && (
                    <span className="text-sm text-muted-foreground truncate">
                      {item.varieteNom ?? item.varieteId}
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
                          <span className="font-semibold text-sm">{groupe.especeNom ?? groupe.especeId}</span>
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
                              onClick={() => {
                                setActionValue("")
                                setPendingAction({
                                  kind: "irrigation",
                                  irrigationId: item.id,
                                  label: `${groupe.especeNom ?? groupe.especeId} · ${item.plancheId || "Sans planche"}`,
                                })
                              }}
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

      <Dialog open={pendingAction !== null} onOpenChange={(nextOpen) => {
        if (!nextOpen && !actionLoading) setPendingAction(null)
      }}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-[430px]">
          {pendingAction?.kind === "recolte" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <DialogTitle>Enregistrer la récolte</DialogTitle>
                <DialogDescription>{pendingAction.label} — indiquez la quantité réellement récoltée.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 rounded-xl border border-purple-200 bg-purple-50/60 p-4">
                <Label htmlFor="task-recolte-quantite">Quantité récoltée</Label>
                <div className="relative">
                  <Input
                    id="task-recolte-quantite"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    autoFocus
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") enregistrerRecolte(pendingAction.cultureId, pendingAction.especeId)
                    }}
                    placeholder="0,00"
                    className="h-11 bg-white pr-12 text-base"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground">kg</span>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setPendingAction(null)} disabled={actionLoading}>Retour</Button>
                <Button onClick={() => enregistrerRecolte(pendingAction.cultureId, pendingAction.especeId)} disabled={actionLoading}>
                  {actionLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer la récolte
                </Button>
              </div>
            </>
          )}

          {pendingAction?.kind === "irrigation" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100">
                  <Droplets className="h-5 w-5 text-cyan-600" />
                </div>
                <DialogTitle>Confirmer l’arrosage</DialogTitle>
                <DialogDescription>{pendingAction.label}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
                <Label htmlFor="task-irrigation-notes">Observation facultative</Label>
                <Textarea
                  id="task-irrigation-notes"
                  autoFocus
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  placeholder="Sol sec, pluie récente, quantité ajustée…"
                  className="min-h-24 resize-none bg-white"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setPendingAction(null)} disabled={actionLoading}>Retour</Button>
                <Button onClick={() => marquerIrrigation(pendingAction.irrigationId)} disabled={actionLoading}>
                  {actionLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmer l’arrosage
                </Button>
              </div>
            </>
          )}

          {pendingAction?.kind === "annulation-recolte" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                </div>
                <DialogTitle>Annuler cette récolte ?</DialogTitle>
                <DialogDescription>
                  La récolte de {pendingAction.label} sera marquée à faire et les quantités encore en stock seront retirées.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setPendingAction(null)} disabled={actionLoading}>Conserver</Button>
                <Button variant="destructive" onClick={() => annulerRecolte(pendingAction.cultureId)} disabled={actionLoading}>
                  {actionLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Annuler la récolte
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
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
