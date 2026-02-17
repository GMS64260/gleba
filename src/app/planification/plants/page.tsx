"use client"

/**
 * Page Plants necessaires
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Package, AlertTriangle, Leaf } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

interface BesoinPlant {
  especeId: string
  especeCouleur: string | null
  varieteId: string | null
  nbPlants: number
  semainePlantation: number | null
  stockActuel: number
  aCommander: number
  cultures: { plancheId: string; surface: number; nbPlants: number }[]
}

interface Stats {
  nbEspeces: number
  totalPlants: number
  totalCultures: number
  totalACommander: number
  especesSansStock: number
  parSemaine: Record<number, number>
}

const columns: ColumnDef<BesoinPlant>[] = [
  {
    accessorKey: "especeId",
    header: "Espece",
    cell: ({ row }) => {
      const b = row.original
      return (
        <div className="flex items-center gap-2">
          {b.especeCouleur && (
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: b.especeCouleur }}
            />
          )}
          <span className="font-medium">{b.especeId}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "varieteId",
    header: "Variete",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "semainePlantation",
    header: "Plantation",
    cell: ({ getValue }) => {
      const s = getValue() as number | null
      return s ? (
        <Badge variant="outline">S{s}</Badge>
      ) : "-"
    },
  },
  {
    accessorKey: "nbPlants",
    header: "Nb plants",
    cell: ({ getValue }) => (
      <span className="font-medium">{(getValue() as number).toLocaleString()}</span>
    ),
  },
  {
    accessorKey: "stockActuel",
    header: "Stock",
    cell: ({ getValue }) => {
      const val = getValue() as number
      return val > 0 ? val.toLocaleString() : "-"
    },
  },
  {
    accessorKey: "aCommander",
    header: "A commander",
    cell: ({ row }) => {
      const val = row.original.aCommander
      if (val <= 0) {
        return <Badge variant="default" className="bg-green-600">OK</Badge>
      }
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {val.toLocaleString()}
        </Badge>
      )
    },
  },
  {
    id: "cultures",
    header: "Planches",
    cell: ({ row }) => {
      const cultures = row.original.cultures
      return (
        <div className="flex flex-wrap gap-1">
          {cultures.slice(0, 4).map((c) => (
            <Link key={c.plancheId} href={`/planches/${encodeURIComponent(c.plancheId)}`}>
              <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-gray-200">
                {c.plancheId} ({c.nbPlants})
              </Badge>
            </Link>
          ))}
          {cultures.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{cultures.length - 4}
            </Badge>
          )}
        </div>
      )
    },
  },
]

function PlantsContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<BesoinPlant[]>([])
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(
    parseInt(searchParams.get("annee") || new Date().getFullYear().toString())
  )

  const annees = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
  }, [])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/planification/plants?annee=${annee}`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setStats(result.stats)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les besoins en plants",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExport = () => {
    const headers = ["Espece", "Variete", "Semaine plantation", "Nb plants", "Stock", "A commander", "Planches"]
    const rows = data.map(b => [
      b.especeId,
      b.varieteId || "",
      b.semainePlantation?.toString() || "",
      b.nbPlants.toString(),
      b.stockActuel.toString(),
      b.aCommander.toString(),
      b.cultures.map(c => c.plancheId).join(", "),
    ])

    const csv = [headers, ...rows].map(r => r.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `plants-necessaires-${annee}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/?tab=planification">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Planification
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Leaf className="h-6 w-6 text-cyan-600" />
              <h1 className="text-xl font-bold">Plants necessaires</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/stocks">
              <Button variant="outline" size="sm">
                <Package className="h-4 w-4 mr-2" />
                Gerer stocks
              </Button>
            </Link>
            <Select
              value={annee.toString()}
              onValueChange={(value) => setAnnee(parseInt(value))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {annees.map((a) => (
                  <SelectItem key={a} value={a.toString()}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Especes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.nbEspeces}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Plants total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalPlants.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Cultures</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalCultures}</p>
              </CardContent>
            </Card>
            <Card className={stats.especesSansStock > 0 ? "border-red-200 bg-red-50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">A commander</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalACommander.toLocaleString()}</p>
                {stats.especesSansStock > 0 && (
                  <p className="text-sm text-red-600">{stats.especesSansStock} espece(s) sans stock</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Info */}
        <div className="mb-4 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
          <p className="text-sm text-cyan-800">
            Cette page liste les plants necessaires pour les cultures avec plantation (pas semis direct).
            Le nombre de plants est calcule a partir de l'espacement et du nombre de rangs definis dans l'ITP.
          </p>
        </div>

        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          pageCount={1}
          pageIndex={0}
          pageSize={data.length || 50}
          onPaginationChange={() => {}}
          onRefresh={fetchData}
          onExport={handleExport}
          searchPlaceholder="Rechercher..."
          emptyMessage="Aucun besoin en plants calcule."
        />
      </main>
    </div>
  )
}

export default function PlantsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <PlantsContent />
    </Suspense>
  )
}
