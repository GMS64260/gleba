"use client"

/**
 * Page Rotations - Plans de rotation des cultures
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, LayoutGrid, AlertTriangle } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"

// Type pour les rotations avec relations
interface RotationDetail {
  id: number
  annee: number
  itpId: string | null
  itp: {
    id: string
    espece: { id: string; couleur: string | null } | null
  } | null
}

interface RotationWithRelations {
  id: string
  active: boolean
  nbAnnees: number | null
  notes: string | null
  details: RotationDetail[]
  _count: { planches: number }
}

// Composant pour afficher le resume des annees
function RotationYears({ details }: { details: RotationDetail[] }) {
  if (details.length === 0) return <span className="text-muted-foreground">-</span>

  return (
    <div className="flex gap-1 flex-wrap">
      {details.map((d) => {
        const couleur = d.itp?.espece?.couleur || '#888888'
        const label = d.itp?.espece?.id || d.itp?.id || '?'
        return (
          <Badge
            key={d.id}
            variant="outline"
            className="text-xs px-1.5"
            style={{ borderColor: couleur, backgroundColor: `${couleur}20` }}
          >
            A{d.annee}: {label}
          </Badge>
        )
      })}
    </div>
  )
}

// Colonnes du tableau
const columns: ColumnDef<RotationWithRelations>[] = [
  {
    accessorKey: "id",
    header: "Rotation",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.id}</span>
    ),
  },
  {
    accessorKey: "active",
    header: "Statut",
    // Bug cmp8rvylm (Marc 2026-05-16) — un badge "Active" vert masquait des
    // rotations sans aucune planche et sans détails. On distingue désormais :
    //   - Active appliquée (>=1 planche, détails non vides) → vert plein
    //   - Active orpheline (0 planche) → vert pâle + ⚠
    //   - Active vide (0 détail) → orange "Incomplète"
    //   - Inactive → secondaire
    cell: ({ row }) => {
      const r = row.original
      if (!r.active) {
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            Inactive
          </Badge>
        )
      }
      if (r.details.length === 0) {
        return (
          <Badge variant="outline" className="border-orange-400 text-orange-700 bg-orange-50">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Incomplète
          </Badge>
        )
      }
      if (r._count.planches === 0) {
        return (
          <Badge variant="outline" className="border-amber-400 text-amber-800 bg-amber-50">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Active (non appliquée)
          </Badge>
        )
      }
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Active
        </Badge>
      )
    },
  },
  {
    accessorKey: "nbAnnees",
    header: "Cycle",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? `${val} an${val > 1 ? 's' : ''}` : "-"
    },
  },
  {
    id: "details",
    header: "Plan de rotation",
    cell: ({ row }) => <RotationYears details={row.original.details} />,
  },
  {
    accessorKey: "_count.planches",
    header: "Planches",
    cell: ({ getValue }) => {
      const count = getValue() as number
      return (
        <div className="flex items-center gap-1">
          <LayoutGrid className="h-3 w-3 text-muted-foreground" />
          {count}
        </div>
      )
    },
  },
]

export default function RotationsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<RotationWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const pageSize = 50

  // Charger les données
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const url = `/api/rotations?page=${pageIndex + 1}&pageSize=${pageSize}`
      const response = await fetch(url)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setPageCount(result.totalPages)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les rotations",
      })
    } finally {
      setIsLoading(false)
    }
  }, [pageIndex, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handlers
  const handleAdd = () => {
    router.push("/rotations/new")
  }

  const handleRowClick = (row: RotationWithRelations) => {
    router.push(`/rotations/${encodeURIComponent(row.id)}`)
  }

  const handleEdit = (row: RotationWithRelations) => {
    router.push(`/rotations/${encodeURIComponent(row.id)}`)
  }

  const handleDelete = async (row: RotationWithRelations) => {
    if (row._count.planches > 0) {
      toast({
        variant: "destructive",
        title: "Impossible de supprimer",
        description: `${row.id} est utilisee par ${row._count.planches} planche(s)`,
      })
      return
    }

    if (!(await confirmDialog(`Supprimer la rotation "${row.id}" ?`))) return

    try {
      const response = await fetch(`/api/rotations/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Erreur lors de la suppression")
      toast({
        title: "Rotation supprimée",
        description: `La rotation "${row.id}" a été supprimée`,
      })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer la rotation",
      })
    }
  }

  // Export CSV
  const handleExport = () => {
    const headers = ["Rotation", "Active", "Nb Années", "Planches", "Détails"]
    const rows = data.map(r => [
      r.id,
      r.active ? "Oui" : "Non",
      r.nbAnnees?.toString() || "",
      r._count.planches.toString(),
      r.details.map(d => `A${d.annee}:${d.itp?.espece?.id || d.itp?.id || '?'}`).join(" | "),
    ])

    const csv = [headers, ...rows].map(row => row.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "rotations.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Accueil
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-orange-600" />
            <h1 className="text-xl font-bold">Rotations</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Bug #1 — Banner cohérence : rotations actives sans planche assignée */}
        {(() => {
          const orphelines = data.filter((r) => r.active && r._count.planches === 0)
          if (orphelines.length === 0) return null
          const first = orphelines[0]
          return (
            <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-300 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 text-sm text-amber-900">
                <p className="font-medium">
                  {orphelines.length === 1
                    ? "1 rotation active mais non appliquée"
                    : `${orphelines.length} rotations actives mais non appliquées`}
                </p>
                <p className="mt-1 text-amber-800">
                  Une rotation Active sans planche rattachée n'a aucun effet. Rattachez-la à au moins une planche depuis sa page d'édition.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {orphelines.slice(0, 5).map((r) => (
                    <Link
                      key={r.id}
                      href={`/maraichage/rotations/${encodeURIComponent(r.id)}`}
                      className="text-xs px-2 py-1 bg-white border border-amber-300 rounded hover:bg-amber-100 font-medium"
                    >
                      {r.id} →
                    </Link>
                  ))}
                  {orphelines.length > 5 && (
                    <span className="text-xs text-amber-700 self-center">
                      +{orphelines.length - 5} autres
                    </span>
                  )}
                </div>
                <Link
                  href={`/maraichage/rotations/${encodeURIComponent(first.id)}`}
                  className="inline-block mt-2 text-xs font-medium text-amber-900 underline"
                >
                  Assigner maintenant
                </Link>
              </div>
            </div>
          )
        })()}

        {/* Info */}
        <div className="mb-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-orange-600 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p className="font-medium">Qu'est-ce qu'une rotation ?</p>
              <p className="mt-1 text-orange-700">
                Une rotation définit la succession des cultures sur plusieurs années.
                Chaque annee du cycle est associée a un ITP (Itinéraire Technique de Plante).
                Assignez une rotation a vos planches pour planifier automatiquement les cultures futures.
              </p>
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          pageCount={pageCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPaginationChange={(page) => setPageIndex(page)}
          onAdd={handleAdd}
          onRefresh={fetchData}
          onExport={handleExport}
          onRowClick={handleRowClick}
          onRowEdit={handleEdit}
          onRowDelete={handleDelete}
          searchPlaceholder="Rechercher une rotation..."
          emptyMessage="Aucune rotation trouvée. Cliquez sur + pour en créer une."
        />
      </main>
    </div>
  )
}
