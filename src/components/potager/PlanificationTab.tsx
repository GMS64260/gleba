"use client"

/**
 * Onglet Planification - Hub de planification + ITPs + Stocks
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  surfaceTotale: number
  recoltesTotales: number
  nbEspeces: number
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
    title: "Cultures prevues par espece",
    href: "/planification/cultures-prevues",
    icon: Leaf,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    title: "Par ilots",
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
    title: "Recoltes par mois",
    href: "/planification/recoltes-prevues",
    icon: BarChart3,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    title: "Recoltes par semaines",
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
    title: "Creer cultures",
    href: "/planification/creer-cultures",
    icon: FileStack,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
  },
  {
    title: "Semences necessaires",
    href: "/planification/semences",
    icon: Sprout,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  {
    title: "Plants necessaires",
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
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-green-100 text-xs">Cultures prevues</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-12 bg-green-400" /> : stats?.totalCultures || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-green-100">{stats?.culturesACreer || 0} a creer</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-amber-100 text-xs">Surface totale</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-16 bg-amber-400" /> : `${stats?.surfaceTotale || 0} m2`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-amber-100">Planifiee pour {year}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-blue-100 text-xs">Recoltes prevues</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-16 bg-blue-400" /> : `${stats?.recoltesTotales || 0} kg`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-blue-100">Estimation annuelle</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-purple-100 text-xs">Especes</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-10 bg-purple-400" /> : stats?.nbEspeces || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-purple-100">Varietes planifiees</p>
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

function formatSemaine(semaine: number | null): string {
  if (!semaine) return "-"
  return `S${semaine}`
}

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
    header: "Espece",
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
    header: "Recolte",
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

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/itps?pageSize=200")
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      setData(Array.isArray(result) ? result : result.data || [])
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les ITPs" })
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
        <p className="font-medium">Itineraires Techniques</p>
        <p className="mt-1 text-indigo-700">
          Les ITPs definissent les parametres de culture pour chaque espece : espacement, dates de
          semis/plantation/recolte, nombre de rangs.
        </p>
      </div>
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
        emptyMessage="Aucun ITP trouve."
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
          Gerez vos inventaires de semences, plants et fertilisants.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/stocks">
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
        <Link href="/recoltes">
          <Card className="hover:shadow-md transition-all hover:scale-[1.01] cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-sm">Suivi recoltes</CardTitle>
                  <CardDescription className="text-xs">Production, ventes, pertes</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/cultures/irriguer">
          <Card className="hover:shadow-md transition-all hover:scale-[1.01] cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center">
                  <Sprout className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <CardTitle className="text-sm">Irrigation</CardTitle>
                  <CardDescription className="text-xs">Cultures a irriguer</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
