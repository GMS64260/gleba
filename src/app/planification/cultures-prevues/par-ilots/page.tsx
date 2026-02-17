"use client"

/**
 * Page Cultures prevues par ilot
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Map, CheckCircle2, XCircle } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

interface CulturePrevue {
  plancheId: string
  ilot: string | null
  especeId: string | null
  especeCouleur: string | null
  itpId: string | null
  annee: number
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  surface: number
  existante: boolean
}

function formatSemaine(s: number | null): string {
  return s ? `S${s}` : "-"
}

const columns: ColumnDef<CulturePrevue>[] = [
  {
    accessorKey: "ilot",
    header: "Ilot",
    cell: ({ getValue }) => {
      const ilot = getValue() as string | null
      return ilot ? (
        <Badge variant="outline" className="font-medium">
          {ilot}
        </Badge>
      ) : (
        <span className="text-muted-foreground">Sans ilot</span>
      )
    },
  },
  {
    accessorKey: "plancheId",
    header: "Planche",
    cell: ({ row }) => (
      <Link href={`/planches/${encodeURIComponent(row.original.plancheId)}`}>
        <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200">
          {row.original.plancheId}
        </Badge>
      </Link>
    ),
  },
  {
    accessorKey: "especeId",
    header: "Espece",
    cell: ({ row }) => {
      const culture = row.original
      return (
        <div className="flex items-center gap-2">
          {culture.especeCouleur && (
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: culture.especeCouleur }}
            />
          )}
          <span>{culture.especeId || "-"}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "semaineSemis",
    header: "Semis",
    cell: ({ getValue }) => formatSemaine(getValue() as number | null),
  },
  {
    accessorKey: "semainePlantation",
    header: "Plantation",
    cell: ({ getValue }) => formatSemaine(getValue() as number | null),
  },
  {
    accessorKey: "semaineRecolte",
    header: "Recolte",
    cell: ({ getValue }) => formatSemaine(getValue() as number | null),
  },
  {
    accessorKey: "surface",
    header: "Surface",
    cell: ({ getValue }) => `${(getValue() as number).toFixed(1)} m2`,
  },
  {
    accessorKey: "existante",
    header: "Statut",
    cell: ({ getValue }) => {
      const existante = getValue() as boolean
      return existante ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-gray-400" />
      )
    },
  },
]

function CulturesPrevuesParIlotsContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<CulturePrevue[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(
    parseInt(searchParams.get("annee") || new Date().getFullYear().toString())
  )
  const [stats, setStats] = React.useState<{ parIlot: Record<string, number> }>({ parIlot: {} })

  const annees = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
  }, [])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/planification/cultures-prevues?annee=${annee}&groupBy=ilot`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setStats(result.stats)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les cultures prevues",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExport = () => {
    const headers = ["Ilot", "Planche", "Espece", "S.Semis", "S.Plantation", "S.Recolte", "Surface (m2)", "Statut"]
    const rows = data.map(c => [
      c.ilot || "Sans ilot",
      c.plancheId,
      c.especeId || "",
      c.semaineSemis?.toString() || "",
      c.semainePlantation?.toString() || "",
      c.semaineRecolte?.toString() || "",
      c.surface.toFixed(1),
      c.existante ? "Creee" : "A creer",
    ])

    const csv = [headers, ...rows].map(r => r.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `cultures-prevues-ilots-${annee}.csv`
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
              <Map className="h-6 w-6 text-amber-600" />
              <h1 className="text-xl font-bold">Cultures prevues par ilot</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              {Object.entries(stats.parIlot).slice(0, 3).map(([ilot, count]) => (
                <Badge key={ilot} variant="outline">
                  {ilot}: {count}
                </Badge>
              ))}
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
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Onglets */}
        <div className="flex gap-2 mb-4">
          <Link href={`/planification/cultures-prevues?annee=${annee}`}>
            <Button variant="outline" size="sm">
              Par espece
            </Button>
          </Link>
          <Link href={`/planification/cultures-prevues/par-ilots?annee=${annee}`}>
            <Button variant="default" size="sm">
              Par ilots
            </Button>
          </Link>
          <Link href={`/planification/cultures-prevues/par-planches?annee=${annee}`}>
            <Button variant="outline" size="sm">
              Par planches
            </Button>
          </Link>
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
          emptyMessage="Aucune culture prevue."
        />
      </main>
    </div>
  )
}

export default function CulturesPrevuesParIlotsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <CulturesPrevuesParIlotsContent />
    </Suspense>
  )
}
