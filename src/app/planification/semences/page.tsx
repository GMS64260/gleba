"use client"

/**
 * Page Semences necessaires
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Sprout, AlertTriangle } from "lucide-react"

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

interface BesoinSemence {
  especeId: string
  especeCouleur: string | null
  varieteId: string | null
  surfaceTotale: number
  nbPlants: number
  grainesNecessaires: number
  stockActuel: number
  nbGrainesG: number | null
  aCommander: number
}

interface Stats {
  nbEspeces: number
  totalPlants: number
  totalGraines: number
  totalACommander: number
  especesSansStock: number
}

const columns: ColumnDef<BesoinSemence>[] = [
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
    accessorKey: "surfaceTotale",
    header: "Surface",
    cell: ({ getValue }) => `${(getValue() as number).toFixed(1)} m2`,
  },
  {
    accessorKey: "nbPlants",
    header: "Nb plants",
    cell: ({ getValue }) => (getValue() as number).toLocaleString(),
  },
  {
    accessorKey: "nbGrainesG",
    header: "Graines/g",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? val.toLocaleString() : "-"
    },
  },
  {
    accessorKey: "grainesNecessaires",
    header: "Graines (g)",
    cell: ({ getValue }) => `${(getValue() as number).toFixed(1)} g`,
  },
  {
    accessorKey: "stockActuel",
    header: "Stock (g)",
    cell: ({ getValue }) => `${(getValue() as number).toFixed(1)} g`,
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
          {val.toFixed(1)} g
        </Badge>
      )
    },
  },
]

function SemencesContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<BesoinSemence[]>([])
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
      const response = await fetch(`/api/planification/semences?annee=${annee}`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setStats(result.stats)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les besoins en semences",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExport = () => {
    const headers = ["Espece", "Variete", "Surface (m2)", "Nb plants", "Graines/g", "Graines nec. (g)", "Stock (g)", "A commander (g)"]
    const rows = data.map(b => [
      b.especeId,
      b.varieteId || "",
      b.surfaceTotale.toFixed(1),
      b.nbPlants.toString(),
      b.nbGrainesG?.toString() || "",
      b.grainesNecessaires.toFixed(1),
      b.stockActuel.toFixed(1),
      b.aCommander.toFixed(1),
    ])

    const csv = [headers, ...rows].map(r => r.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `semences-necessaires-${annee}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/planification">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Planification
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Sprout className="h-6 w-6 text-orange-600" />
              <h1 className="text-xl font-bold">Semences necessaires</h1>
            </div>
          </div>

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
                <CardTitle className="text-sm text-muted-foreground">Graines necessaires</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalGraines.toFixed(0)} g</p>
              </CardContent>
            </Card>
            <Card className={stats.especesSansStock > 0 ? "border-red-200 bg-red-50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">A commander</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalACommander.toFixed(0)} g</p>
                {stats.especesSansStock > 0 && (
                  <p className="text-sm text-red-600">{stats.especesSansStock} espece(s) sans stock</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

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
          emptyMessage="Aucun besoin en semences calcule."
        />
      </main>
    </div>
  )
}

export default function SemencesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <SemencesContent />
    </Suspense>
  )
}
