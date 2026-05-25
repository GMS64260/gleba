"use client"

/**
 * Page Cultures prevues par planche
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { formatSemaine } from "@/lib/assistant-helpers"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, LayoutGrid, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

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
  rotationId: string | null
  rotationAnnee: number
  annee: number
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  surface: number
  existante: boolean
}

// Bug cmp8sb0at (Marc 2026-05-16) — Le statut OK vert indiquait "ligne créée"
// pas "plan agronomique valide". On évalue désormais des conflits réels :
//  - empty : aucune date semis/plantation/récolte (kiwi sans planning)
//  - overlap : chevauchement temporel avec une autre culture de la même planche
//  - ok : sinon
type StatutAgro = 'empty' | 'overlap' | 'ok' | 'todo'

function periode(c: CulturePrevue): [number, number] | null {
  const debut = c.semaineSemis ?? c.semainePlantation
  const fin = c.semaineRecolte
  if (debut == null || fin == null) return null
  return [debut, Math.max(debut, fin)]
}

function evaluerStatut(c: CulturePrevue, toutes: CulturePrevue[]): StatutAgro {
  if (c.semaineSemis == null && c.semainePlantation == null && c.semaineRecolte == null) {
    return c.existante ? 'empty' : 'todo'
  }
  const p = periode(c)
  if (p) {
    const conflits = toutes.filter((o) => {
      if (o === c) return false
      if (o.plancheId !== c.plancheId) return false
      const op = periode(o)
      if (!op) return false
      return op[0] <= p[1] && p[0] <= op[1]
    })
    if (conflits.length > 0) return 'overlap'
  }
  return c.existante ? 'ok' : 'todo'
}

const columns: ColumnDef<CulturePrevue>[] = [
  {
    accessorKey: "plancheId",
    header: "Planche",
    cell: ({ row }) => (
      <Link href={`/maraichage/planches/${encodeURIComponent(row.original.plancheId)}`}>
        <Badge variant="default" className="cursor-pointer">
          {row.original.plancheId}
        </Badge>
      </Link>
    ),
  },
  {
    accessorKey: "ilot",
    header: "Îlot",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "rotationId",
    header: "Rotation",
    cell: ({ row }) => {
      const { rotationId, rotationAnnee } = row.original
      if (!rotationId) return "-"
      return (
        <Link href={`/maraichage/rotations/${encodeURIComponent(rotationId)}`}>
          <span className="text-sm text-blue-600 hover:underline">
            {rotationId} (A{rotationAnnee})
          </span>
        </Link>
      )
    },
  },
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
    header: "Récolte",
    cell: ({ getValue }) => formatSemaine(getValue() as number | null),
  },
  {
    accessorKey: "surface",
    header: "Surface",
    cell: ({ getValue }) => `${(getValue() as number).toFixed(1)} m²`,
  },
  {
    id: "statut",
    header: "Statut",
    cell: ({ row, table }) => {
      const all = table.getCoreRowModel().rows.map((r) => r.original as CulturePrevue)
      const statut = evaluerStatut(row.original, all)
      if (statut === 'overlap') {
        return (
          <span className="inline-flex items-center gap-1 text-amber-700" title="Chevauchement avec une autre culture sur cette planche">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs">Chevauchement</span>
          </span>
        )
      }
      if (statut === 'empty') {
        return (
          <span className="inline-flex items-center gap-1 text-orange-600" title="Aucune date de semis/plantation/récolte renseignée">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs">Dates vides</span>
          </span>
        )
      }
      if (statut === 'todo') {
        return (
          <span className="inline-flex items-center gap-1 text-slate-400" title="Culture planifiée à créer">
            <XCircle className="h-4 w-4" />
            <span className="text-xs">À créer</span>
          </span>
        )
      }
      return (
        <span className="inline-flex items-center gap-1 text-green-600" title="Plan agronomique cohérent">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs">OK</span>
        </span>
      )
    },
  },
]

function CulturesPrevuesParPlanchesContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<CulturePrevue[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(
    parseInt(searchParams.get("annee") || new Date().getFullYear().toString())
  )
  const [stats, setStats] = React.useState<{ total: number }>({ total: 0 })

  const annees = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
  }, [])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/planification/cultures-prevues?annee=${annee}&groupBy=planche`)
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
    const headers = ["Planche", "Îlot", "Rotation", "Année Rot.", "Espèce", "S.Semis", "S.Plantation", "S.Récolte", "Surface (m²)", "Statut"]
    const rows = data.map(c => [
      c.plancheId,
      c.ilot || "",
      c.rotationId || "",
      c.rotationAnnee.toString(),
      c.especeId || "",
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
    link.download = `cultures-prevues-planches-${annee}.csv`
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
              <LayoutGrid className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">Cultures prévues par planche</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="outline">{stats.total} cultures</Badge>
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
            <Button variant="outline" size="sm">
              Par espèce
            </Button>
          </Link>
          <Link href={`/maraichage/planification/cultures-prevues/par-ilots?annee=${annee}`}>
            <Button variant="outline" size="sm">
              Par îlots
            </Button>
          </Link>
          <Link href={`/maraichage/planification/cultures-prevues/par-planches?annee=${annee}`}>
            <Button variant="default" size="sm">
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
          emptyMessage="Aucune culture prévue."
        />
      </main>
    </div>
  )
}

export default function CulturesPrevuesParPlanchesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <CulturesPrevuesParPlanchesContent />
    </Suspense>
  )
}
