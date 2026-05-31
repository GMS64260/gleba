"use client"

/**
 * Onglet Planification - Hub de planification + ITPs + Stocks
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatSemaine } from "@/lib/assistant-helpers"
import { ColumnDef } from "@tanstack/react-table"
import {
  Leaf,
  Map,
  LayoutGrid,
  BarChart3,
  CalendarRange,
  Users,
  FileStack,
  Sprout,
  Package,
  Route,
  ArrowRight,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { kpiCardClass, kpiSubtleClass } from "@/lib/kpi-theme"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/tables/DataTable"
import { useToast } from "@/hooks/use-toast"

// ============================================================
// Types
// ============================================================

interface Stats {
  totalCultures: number
  culturesExistantes: number
  culturesACreer: number
  // surfaceTotale = surface planifiée (alimentée par getKpiMaraichage SSOT).
  surfaceTotale: number
  surfaceCultivee?: number
  surfacePlanifiee?: number
  recoltesTotales: number
  // BUG-feedback (Marc 2026-05-16) : champs unifiés avec
  // /api/planification/recoltes-prevues et le Calendrier.
  recoltesRealiseesKg?: number
  recoltesProjectionKg?: number
  recoltesTotalAttenduKg?: number
  nbEspeces: number
  nbVarietes?: number
  nbEspecesAvecVariete?: number
  annee: number
}

interface ITPWithRelations {
  id: string
  especeId: string | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  dureePepiniere: number | null
  dureeCulture: number | null
  nbRangs: number | null
  espacement: number | null
  notes: string | null
  espece: {
    id: string
    couleur: string | null
    famille: { id: string; couleur: string | null } | null
  } | null
  _count: { cultures: number; rotationsDetails: number }
}

// ============================================================
// Sous-onglets planification
// ============================================================

const planifLinks = [
  {
    title: "Cultures prévues par espèce",
    href: "/planification/cultures-prevues",
    icon: Leaf,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    title: "Par îlots",
    href: "/planification/cultures-prevues/par-ilots",
    icon: Map,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    title: "Par planches",
    href: "/planification/cultures-prevues/par-planches",
    icon: LayoutGrid,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    title: "Récoltes par mois",
    href: "/planification/recoltes-prevues",
    icon: BarChart3,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    title: "Récoltes par semaines",
    href: "/planification/recoltes-prevues/par-semaines",
    icon: CalendarRange,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  {
    title: "Associations cultures",
    href: "/planification/associations",
    icon: Users,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
  },
  {
    title: "Créer cultures",
    href: "/planification/creer-cultures",
    icon: FileStack,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
  },
  {
    title: "Semences nécessaires",
    href: "/planification/semences",
    icon: Sprout,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  {
    title: "Plants nécessaires",
    href: "/planification/plants",
    icon: Package,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
  },
]

interface PlanificationTabProps {
  year: number
}

export function PlanificationTab({ year }: PlanificationTabProps) {
  return (
    <Tabs defaultValue="planification" className="space-y-4">
      <TabsList>
        <TabsTrigger value="planification" className="flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4" />
          Planification
        </TabsTrigger>
        <TabsTrigger value="itps" className="flex items-center gap-1.5">
          <Route className="h-4 w-4" />
          ITPs
        </TabsTrigger>
        <TabsTrigger value="stocks" className="flex items-center gap-1.5">
          <Package className="h-4 w-4" />
          Stocks
        </TabsTrigger>
      </TabsList>

      <TabsContent value="planification">
        <PlanificationSubTab year={year} />
      </TabsContent>
      <TabsContent value="itps">
        <ItpsSubTab />
      </TabsContent>
      <TabsContent value="stocks">
        <StocksSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Planification hub
// ============================================================

function PlanificationSubTab({ year }: { year: number }) {
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchStats() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/planification/stats?annee=${year}`)
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch {
        // silent
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [year])

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className={kpiCardClass("neutre")}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className={`${kpiSubtleClass("neutre")} text-xs`}>Cultures prévues</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-12 bg-slate-500" /> : stats?.totalCultures || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className={`text-xs ${kpiSubtleClass("neutre")}`}>{stats?.culturesACreer || 0} à créer</p>
          </CardContent>
        </Card>

        <Card className={kpiCardClass("neutre")}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className={`${kpiSubtleClass("neutre")} text-xs`}>Surface planifiée</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-16 bg-slate-500" /> : `${stats?.surfacePlanifiee ?? stats?.surfaceTotale ?? 0} m²`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {stats && stats.surfaceCultivee !== undefined && stats.surfaceCultivee !== stats.surfacePlanifiee ? (
              <p className={`text-xs ${kpiSubtleClass("neutre")}`}>
                Dont cultivée {stats.surfaceCultivee} m²
              </p>
            ) : (
              <p className={`text-xs ${kpiSubtleClass("neutre")}`}>Planifiée pour {year}</p>
            )}
          </CardContent>
        </Card>

        <Card className={kpiCardClass("revenu")}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className={`${kpiSubtleClass("revenu")} text-xs`}>Récoltes {stats?.annee ?? year} attendues</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading
                ? <Skeleton className="h-8 w-16 bg-emerald-400" />
                : `${(stats?.recoltesTotalAttenduKg ?? stats?.recoltesTotales ?? 0).toFixed(1)} kg`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className={`text-xs ${kpiSubtleClass("revenu")}`}>
              {(stats?.recoltesRealiseesKg ?? 0).toFixed(1)} kg réalisé · {(stats?.recoltesProjectionKg ?? stats?.recoltesTotales ?? 0).toFixed(1)} kg à venir
            </p>
          </CardContent>
        </Card>

        <Card className={kpiCardClass("neutre")}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className={`${kpiSubtleClass("neutre")} text-xs`}>Variétés planifiées</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? (
                <Skeleton className="h-8 w-10 bg-slate-500" />
              ) : (
                stats?.nbVarietes ?? 0
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className={`text-xs ${kpiSubtleClass("neutre")}`}>
              {stats?.nbEspeces ? `${stats.nbEspeces} espèce(s) couverte(s)` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Liens d'action */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {planifLinks.map((item) => (
          <Link key={item.href} href={`${item.href}?annee=${year}`}>
            <Card className="h-full hover:shadow-md transition-all hover:scale-[1.01] cursor-pointer group">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg ${item.bgColor} flex items-center justify-center`}
                  >
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    {item.title}
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardTitle>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// ITPs
// ============================================================


const itpColumns: ColumnDef<ITPWithRelations>[] = [
  {
    accessorKey: "id",
    header: "ITP",
    cell: ({ row }) => {
      const itp = row.original
      const couleur = itp.espece?.couleur || itp.espece?.famille?.couleur || "#888888"
      return (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: couleur }} />
          <span className="font-medium">{itp.id}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "espece.id",
    header: "Espèce",
    cell: ({ row }) => row.original.espece?.id || "-",
  },
  {
    accessorKey: "semaineSemis",
    header: "Semis",
    cell: ({ getValue }) => (
      <Badge variant="outline" className="text-xs">
        {formatSemaine(getValue() as number | null)}
      </Badge>
    ),
  },
  {
    accessorKey: "semainePlantation",
    header: "Plantation",
    cell: ({ getValue }) => (
      <Badge variant="outline" className="text-xs">
        {formatSemaine(getValue() as number | null)}
      </Badge>
    ),
  },
  {
    accessorKey: "semaineRecolte",
    header: "Récolte",
    cell: ({ getValue }) => (
      <Badge variant="outline" className="text-xs">
        {formatSemaine(getValue() as number | null)}
      </Badge>
    ),
  },
  {
    accessorKey: "nbRangs",
    header: "Rangs",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "espacement",
    header: "Esp. (cm)",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "_count.cultures",
    header: "Cultures",
    cell: ({ getValue }) => getValue() || 0,
  },
]

function ItpsSubTab() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<ITPWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  const [loadError, setLoadError] = React.useState<string | null>(null)
  // Bug feedback testeur 2026-05-26 (cmplonap8) — "Failed to fetch"
  // intermittent au premier clic sur l'onglet ITPs. Souvent une race
  // navigateur (TypeError) plutôt qu'une erreur serveur. On ajoute un
  // retry automatique transparent pour ne pas exposer ce flake à l'user.
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    const attempt = async (retriesLeft: number): Promise<void> => {
      try {
        const response = await fetch("/api/itps?pageSize=200", { cache: "no-store" })
        if (!response.ok) {
          // Feedback Marc 2026-05-16 — Bug 13 : on récupère le détail
          // d'erreur retourné par l'API pour ne pas afficher un toast
          // générique qui contredit l'état "Aucun ITP trouvé." du DataTable.
          let msg = `Erreur ${response.status}`
          try {
            const errJson = await response.json()
            if (errJson?.error) msg = String(errJson.error)
          } catch { /* ignore */ }
          throw new Error(msg)
        }
        const result = await response.json()
        setData(Array.isArray(result) ? result : result.data || [])
      } catch (err) {
        const isNetworkErr =
          err instanceof TypeError ||
          (err instanceof Error && /Failed to fetch|NetworkError/i.test(err.message))
        if (isNetworkErr && retriesLeft > 0) {
          await new Promise((r) => setTimeout(r, 400))
          return attempt(retriesLeft - 1)
        }
        const message = err instanceof Error ? err.message : "Impossible de charger les ITPs"
        setLoadError(message)
        toast({ variant: "destructive", title: "Erreur", description: message })
      }
    }
    try {
      await attempt(1)
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-3">
      <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 text-sm text-indigo-800">
        <p className="font-medium">Itinéraires Techniques</p>
        <p className="mt-1 text-indigo-700">
          Les ITPs définissent les paramètres de culture pour chaque espèce : espacement, dates de
          semis/plantation/récolte, nombre de rangs.
        </p>
      </div>
      {loadError && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-800 flex items-center justify-between">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={fetchData}
            className="text-xs underline hover:no-underline"
          >
            Réessayer
          </button>
        </div>
      )}
      <DataTable
        columns={itpColumns}
        data={data}
        isLoading={isLoading}
        showPagination={false}
        onAdd={() => router.push("/itps/new")}
        onRefresh={fetchData}
        onRowClick={(row) => router.push(`/itps/${encodeURIComponent(row.id)}`)}
        onRowEdit={(row) => router.push(`/itps/${encodeURIComponent(row.id)}`)}
        searchPlaceholder="Rechercher un ITP..."
        emptyMessage={loadError ? "Erreur lors du chargement — cliquez sur Réessayer." : "Aucun ITP trouvé."}
      />
    </div>
  )
}

// ============================================================
// Stocks (lien vers la page dédiée)
// ============================================================

function StocksSubTab() {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-violet-50 rounded-lg border border-violet-200 text-sm text-violet-800">
        <p className="font-medium">Gestion des stocks</p>
        <p className="mt-1 text-violet-700">
          Gérez vos inventaires de semences, plants et fertilisants.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/maraichage/stocks">
          <Card className="hover:shadow-md transition-all hover:scale-[1.01] cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Package className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <CardTitle className="text-sm">Stocks complets</CardTitle>
                  <CardDescription className="text-xs">Semences, plants, fertilisants</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/maraichage/recoltes">
          <Card className="hover:shadow-md transition-all hover:scale-[1.01] cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-sm">Suivi récoltes</CardTitle>
                  <CardDescription className="text-xs">Production, ventes, pertes</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/maraichage/cultures/irriguer">
          <Card className="hover:shadow-md transition-all hover:scale-[1.01] cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center">
                  <Sprout className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <CardTitle className="text-sm">Irrigation</CardTitle>
                  <CardDescription className="text-xs">Cultures à irriguer</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
