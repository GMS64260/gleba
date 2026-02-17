"use client"

/**
 * Onglet Calendrier & Taches du verger - Stats, graphiques et operations en attente
 */

import * as React from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts"
import {
  TreeDeciduous,
  TrendingUp,
  TrendingDown,
  Apple,
  Axe,
  Wrench,
  AlertTriangle,
  ClipboardCheck,
  Check,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { VergerCalendarView } from "./VergerCalendarView"

interface DashboardArbresData {
  stats: {
    arbresTotal: number
    arbresFruitiers: number
    arbresPetitsFruits: number
    arbresForestiers: number
    arbresProductifs: number
    recoltesFruitsAnnee: number
    recoltesFruitsCount: number
    recoltesFruitsAnneePrecedente: number
    productionBoisAnnee: number
    productionBoisKg: number
    venteBoisAnnee: number
    operationsEnAttente: number
  }
  charts: {
    recoltesFruitsMois: { mois: string; quantite: number }[]
    productionBoisMois: { mois: string; volumeM3: number }[]
    boisParDestination: { destination: string; volumeM3: number; couleur: string }[]
    topRecoltesArbres: { arbreId: number; nom: string; type: string; quantite: number }[]
    arbresParType: { type: string; count: number; couleur: string }[]
  }
  activity: {
    prochainesOperations: {
      id: number
      type: string
      datePrevue: string
      arbre: { id: number; nom: string; type: string }
    }[]
    arbresAttention: { id: number; nom: string; type: string; etat: string }[]
  }
  meta: {
    year: number
    generatedAt: string
  }
}

interface OperationArbre {
  id: number
  arbreId: number
  type: string
  datePrevue: string | null
  fait: boolean
  arbre: { id: number; nom: string; type: string }
}

interface CalendrierTabProps {
  year: number
}

export function CalendrierTab({ year }: CalendrierTabProps) {
  const { toast } = useToast()
  const [data, setData] = React.useState<DashboardArbresData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [operationsEnRetard, setOperationsEnRetard] = React.useState<OperationArbre[]>([])
  const [operationsAVenir, setOperationsAVenir] = React.useState<OperationArbre[]>([])
  const [arbresAttention, setArbresAttention] = React.useState<{ id: number; nom: string; type: string; etat: string }[]>([])

  React.useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [statsRes, opsRes, arbresRes] = await Promise.all([
          fetch(`/api/arbres/stats?year=${year}`),
          fetch("/api/arbres/operations?fait=false"),
          fetch("/api/arbres"),
        ])

        if (statsRes.ok) {
          setData(await statsRes.json())
        }

        if (opsRes.ok) {
          const ops: OperationArbre[] = await opsRes.json()
          const today = new Date()
          setOperationsEnRetard(
            ops.filter((op) => op.datePrevue && new Date(op.datePrevue) < today)
          )
          setOperationsAVenir(
            ops.filter((op) => !op.datePrevue || new Date(op.datePrevue) >= today)
          )
        }

        if (arbresRes.ok) {
          const arbres = await arbresRes.json()
          setArbresAttention(
            arbres.filter((a: { etat: string }) => ["mauvais", "moyen"].includes(a.etat))
          )
        }
      } catch {
        toast({ variant: "destructive", title: "Erreur" })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [year, toast])

  const yearDiff = React.useMemo(() => {
    if (!data?.stats) return { diff: 0, percent: "0" }
    const current = data.stats.recoltesFruitsAnnee
    const previous = data.stats.recoltesFruitsAnneePrecedente
    const diff = current - previous
    const percent = previous > 0 ? Math.round((diff / previous) * 100) : 0
    return { diff, percent: percent.toString() }
  }, [data?.stats])

  const handleMarkDone = async (op: OperationArbre) => {
    try {
      const res = await fetch(`/api/arbres/operations/${op.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fait: true, date: new Date().toISOString() }),
      })
      if (res.ok) {
        setOperationsEnRetard((prev) => prev.filter((o) => o.id !== op.id))
        setOperationsAVenir((prev) => prev.filter((o) => o.id !== op.id))
        toast({ title: "Fait !" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-lime-500 to-lime-600 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-lime-100 text-xs">Total arbres</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-12 bg-lime-400" /> : data?.stats.arbresTotal || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-lime-100">{data?.stats.arbresProductifs || 0} productifs</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-green-100 text-xs">Fruitiers</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-12 bg-green-400" /> : data?.stats.arbresFruitiers || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-green-100">+ {data?.stats.arbresPetitsFruits || 0} petits fruits</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-orange-100 text-xs">Recoltes fruits {year}</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-16 bg-orange-400" /> : `${data?.stats.recoltesFruitsAnnee || 0} kg`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="flex items-center gap-1 text-xs">
              {yearDiff.diff >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-200" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-200" />
              )}
              <span className={yearDiff.diff >= 0 ? "text-green-200" : "text-red-200"}>
                {yearDiff.diff >= 0 ? "+" : ""}{yearDiff.percent}% vs {year - 1}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-600 to-amber-700 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-amber-100 text-xs">Production bois</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-16 bg-amber-400" /> : `${data?.stats.productionBoisAnnee || 0} m3`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-amber-100">
              {data?.stats.venteBoisAnnee ? `${data.stats.venteBoisAnnee} EUR vendus` : "Aucune vente"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Calendrier des operations */}
      <VergerCalendarView year={year} />

      {/* Graphiques */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Apple className="h-4 w-4 text-orange-500" />
              Recoltes fruits par mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {data?.charts.recoltesFruitsMois && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.recoltesFruitsMois}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [`${value} kg`, "Recolte"]}
                      labelStyle={{ fontWeight: "bold" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="quantite"
                      stroke="#f97316"
                      fill="#fed7aa"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Axe className="h-4 w-4 text-amber-600" />
              Production bois par mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {data?.charts.productionBoisMois && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.productionBoisMois}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [`${value} m3`, "Volume"]}
                      labelStyle={{ fontWeight: "bold" }}
                    />
                    <Bar dataKey="volumeM3" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TreeDeciduous className="h-4 w-4 text-lime-600" />
              Repartition par type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {data?.charts.arbresParType && data.charts.arbresParType.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.arbresParType}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="count"
                      nameKey="type"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {data.charts.arbresParType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.couleur} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Top recoltes par arbre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {data?.charts.topRecoltesArbres && data.charts.topRecoltesArbres.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.topRecoltesArbres} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="nom"
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip
                      formatter={(value) => [`${value} kg`, "Recolte"]}
                    />
                    <Bar dataKey="quantite" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Aucune recolte enregistree
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Taches */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Operations en retard */}
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              En retard ({operationsEnRetard.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {operationsEnRetard.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune operation en retard</p>
            ) : (
              <div className="space-y-3">
                {operationsEnRetard.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                  >
                    <div>
                      <p className="font-medium">{op.arbre.nom}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {op.type} - prevu le{" "}
                        {op.datePrevue
                          ? new Date(op.datePrevue).toLocaleDateString("fr-FR")
                          : "non defini"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkDone(op)}
                      className="text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Fait
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operations a venir */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-blue-600" />
              A faire ({operationsAVenir.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {operationsAVenir.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune operation planifiee</p>
            ) : (
              <div className="space-y-3">
                {operationsAVenir.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{op.arbre.nom}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {op.type}
                        {op.datePrevue && (
                          <> - prevu le {new Date(op.datePrevue).toLocaleDateString("fr-FR")}</>
                        )}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkDone(op)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Fait
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Arbres a surveiller */}
      {arbresAttention.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-700">
              <TreeDeciduous className="h-4 w-4" />
              Arbres a surveiller ({arbresAttention.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {arbresAttention.map((arbre) => (
                <Link key={arbre.id} href={`/arbres/${arbre.id}`}>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100 hover:bg-yellow-100 transition-colors">
                    <div>
                      <p className="font-medium">{arbre.nom}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {arbre.type.replace("_", " ")}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        arbre.etat === "mauvais"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {arbre.etat}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
