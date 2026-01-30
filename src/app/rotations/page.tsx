"use client"

/**
 * Page Rotations - Plans de rotation des cultures
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, LayoutGrid } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

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
    cell: ({ getValue }) => {
      const active = getValue() as boolean
      return active ? (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Active
        </Badge>
      ) : (
        <Badge variant="secondary">
          <XCircle className="h-3 w-3 mr-1" />
          Inactive
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

  // Charger les donnees
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

    if (!confirm(`Supprimer la rotation "${row.id}" ?`)) return

    try {
      const response = await fetch(`/api/rotations/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Erreur lors de la suppression")
      toast({
        title: "Rotation supprimee",
        description: `La rotation "${row.id}" a ete supprimee`,
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
    const headers = ["Rotation", "Active", "Nb Annees", "Planches", "Details"]
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
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
        {/* Info */}
        <div className="mb-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-orange-600 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p className="font-medium">Qu'est-ce qu'une rotation ?</p>
              <p className="mt-1 text-orange-700">
                Une rotation definit la succession des cultures sur plusieurs annees.
                Chaque annee du cycle est associee a un ITP (Itineraire Technique de Plante).
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
          emptyMessage="Aucune rotation trouvee. Cliquez sur + pour en creer une."
        />
      </main>
    </div>
  )
}
