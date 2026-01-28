"use client"

/**
 * Page Récoltes - Suivi de la production
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { ArrowLeft, BarChart3 } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

// Type pour les récoltes
interface RecolteWithRelations {
  id: number
  especeId: string
  cultureId: number
  date: string
  quantite: number
  notes: string | null
  espece: {
    id: string
    famille: { id: string; couleur: string | null } | null
  }
  culture: {
    id: number
    variete: { id: string } | null
    planche: { id: string } | null
  }
}

// Colonnes du tableau
const columns: ColumnDef<RecolteWithRelations>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ getValue }) => {
      const date = getValue() as string
      return format(new Date(date), "dd/MM/yyyy", { locale: fr })
    },
  },
  {
    accessorKey: "espece.id",
    header: "Espèce",
    cell: ({ row }) => {
      const espece = row.original.espece
      const couleur = espece?.famille?.couleur || '#888888'
      return (
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: couleur }}
          />
          <span className="font-medium">{espece?.id}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "culture.variete.id",
    header: "Variété",
    cell: ({ row }) => row.original.culture?.variete?.id || "-",
  },
  {
    accessorKey: "culture.planche.id",
    header: "Planche",
    cell: ({ row }) => row.original.culture?.planche?.id || "-",
  },
  {
    accessorKey: "quantite",
    header: "Quantité (kg)",
    cell: ({ getValue }) => {
      const val = getValue() as number
      return (
        <span className="font-medium text-green-600">
          {val.toFixed(2)} kg
        </span>
      )
    },
  },
  {
    accessorKey: "cultureId",
    header: "Culture",
    cell: ({ getValue }) => `#${getValue()}`,
  },
  {
    accessorKey: "notes",
    header: "Notes",
    cell: ({ getValue }) => {
      const notes = getValue() as string | null
      return notes ? (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {notes}
        </span>
      ) : "-"
    },
  },
]

export default function RecoltesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<RecolteWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [stats, setStats] = React.useState({ totalQuantite: 0, count: 0 })
  const pageSize = 50

  // Charger les données
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/recoltes?page=${pageIndex + 1}&pageSize=${pageSize}`
      )
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setPageCount(result.totalPages)
      setStats(result.stats)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les récoltes",
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
    router.push("/recoltes/saisie")
  }

  const handleDelete = async (row: RecolteWithRelations) => {
    if (!confirm(`Supprimer cette récolte de ${row.quantite} kg ?`)) return

    try {
      const response = await fetch(`/api/recoltes/${row.id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Erreur lors de la suppression")
      toast({
        title: "Récolte supprimée",
      })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer la récolte",
      })
    }
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
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold">Récoltes</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total récolté
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.totalQuantite.toFixed(1)} kg
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Nombre de récoltes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.count}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
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
          onRowDelete={handleDelete}
          searchPlaceholder="Rechercher une récolte..."
          emptyMessage="Aucune récolte enregistrée."
        />
      </main>
    </div>
  )
}
