"use client"

/**
 * Page Cultures prevues par espece
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { formatSemaine } from "@/lib/assistant-helpers"
import { Skeleton } from "@/components/ui/skeleton"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Leaf, Calendar, CheckCircle2, XCircle, Info } from "lucide-react"

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


const columns: ColumnDef<CulturePrevue>[] = [
  {
    accessorKey: "especeId",
    header: "Espèce",
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
          <span className="font-medium">{culture.especeId || "-"}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "itpId",
    header: "ITP",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "plancheId",
    header: "Planche",
    cell: ({ row }) => (
      <Link href={`/maraichage/planches/${encodeURIComponent(row.original.plancheId)}`}>
        <Badge variant="outline" className="cursor-pointer hover:bg-slate-100">
          {row.original.plancheId}
        </Badge>
      </Link>
    ),
  },
  {
    accessorKey: "ilot",
    header: "Ilot",
    cell: ({ getValue }) => getValue() || "-",
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
      <Badge variant="secondary" className="text-xs">
        {formatSemaine(getValue() as number | null)}
      </Badge>
    ),
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
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Créée
        </Badge>
      ) : (
        <Badge variant="secondary">
          <XCircle className="h-3 w-3 mr-1" />
          A créer
        </Badge>
      )
    },
  },
]

function CulturesPrevuesContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<CulturePrevue[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(
    parseInt(searchParams.get("annee") || new Date().getFullYear().toString())
  )
  const [stats, setStats] = React.useState<{ total: number; existantes: number; aCreer: number }>({
    total: 0,
    existantes: 0,
    aCreer: 0,
  })

  const annees = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
  }, [])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/planification/cultures-prevues?annee=${annee}&groupBy=espece`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setStats(result.stats)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les cultures prévues",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExport = () => {
    const headers = ["Espèce", "ITP", "Planche", "Ilot", "S.Semis", "S.Plantation", "S.Récolte", "Surface (m2)", "Statut"]
    const rows = data.map(c => [
      c.especeId || "",
      c.itpId || "",
      c.plancheId,
      c.ilot || "",
      c.semaineSemis?.toString() || "",
      c.semainePlantation?.toString() || "",
      c.semaineRecolte?.toString() || "",
      c.surface.toFixed(1),
      c.existante ? "Créée" : "A créer",
    ])

    const csv = [headers, ...rows].map(r => r.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `cultures-prevues-${annee}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/?tab=planification">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Planification
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Leaf className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-bold">Cultures prévues par espèce</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{stats.total} cultures</Badge>
              <Badge variant="default" className="bg-green-600">{stats.existantes} créées</Badge>
              <Badge variant="secondary">{stats.aCreer} à créer</Badge>
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
          <Link href={`/maraichage/planification/cultures-prevues?annee=${annee}`}>
            <Button variant="default" size="sm">
              Par espèce
            </Button>
          </Link>
          <Link href={`/maraichage/planification/cultures-prevues/par-ilots?annee=${annee}`}>
            <Button variant="outline" size="sm">
              Par îlots
            </Button>
          </Link>
          <Link href={`/maraichage/planification/cultures-prevues/par-planches?annee=${annee}`}>
            <Button variant="outline" size="sm">
              Par planches
            </Button>
          </Link>
        </div>

        {/* Note testeur 2026-05-31 — clarifier l'écart avec la liste Cultures :
            cet écran agrège le réel (créées) + le prévisionnel des rotations (à
            créer), donc son total dépasse normalement la liste des cultures. */}
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <Info className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
          <p>
            Cet écran combine les cultures <span className="font-medium text-green-700">déjà créées</span> et
            les cultures <span className="font-medium text-slate-700">prévues par vos rotations</span> mais
            pas encore créées. Le total peut donc dépasser celui de la liste <em>Cultures</em>, qui ne montre
            que les cultures réellement enregistrées. Une même planche peut apparaître deux fois (culture réelle
            + étape de rotation) tant que la culture prévue n'a pas été créée.
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
          emptyMessage="Aucune culture prévue. Assignez des rotations a vos planches."
        />
      </main>
    </div>
  )
}


export default function CulturesPrevuesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <CulturesPrevuesContent />
    </Suspense>
  )
}
