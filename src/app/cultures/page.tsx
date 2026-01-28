"use client"

/**
 * Page Cultures - Liste et gestion des cultures
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { ArrowLeft, Leaf } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

// Type pour les cultures avec relations
interface CultureWithRelations {
  id: number
  especeId: string
  varieteId: string | null
  plancheId: string | null
  annee: number | null
  dateSemis: string | null
  datePlantation: string | null
  dateRecolte: string | null
  semisFait: boolean
  plantationFaite: boolean
  recolteFaite: boolean
  terminee: string | null
  notes: string | null
  etat: string
  type: string
  espece: {
    id: string
    famille: { id: string; couleur: string | null } | null
  }
  variete: { id: string } | null
  planche: { id: string } | null
  _count: { recoltes: number }
}

// Couleurs des états
const etatColors: Record<string, string> = {
  'Planifiée': 'bg-blue-100 text-blue-800',
  'Semée': 'bg-green-100 text-green-800',
  'Plantée': 'bg-lime-100 text-lime-800',
  'En récolte': 'bg-amber-100 text-amber-800',
  'Terminée': 'bg-gray-100 text-gray-800',
}

// Colonnes du tableau
const columns: ColumnDef<CultureWithRelations>[] = [
  {
    accessorKey: "id",
    header: "#",
    cell: ({ getValue }) => (
      <span className="font-mono text-sm text-muted-foreground">
        {getValue() as number}
      </span>
    ),
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
    accessorKey: "variete.id",
    header: "Variété",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "planche.id",
    header: "Planche",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "annee",
    header: "Année",
  },
  {
    accessorKey: "dateSemis",
    header: "Semis",
    cell: ({ getValue }) => {
      const date = getValue() as string | null
      return date ? format(new Date(date), "dd/MM", { locale: fr }) : "-"
    },
  },
  {
    accessorKey: "datePlantation",
    header: "Plantation",
    cell: ({ getValue }) => {
      const date = getValue() as string | null
      return date ? format(new Date(date), "dd/MM", { locale: fr }) : "-"
    },
  },
  {
    accessorKey: "dateRecolte",
    header: "Récolte",
    cell: ({ getValue }) => {
      const date = getValue() as string | null
      return date ? format(new Date(date), "dd/MM", { locale: fr }) : "-"
    },
  },
  {
    accessorKey: "etat",
    header: "État",
    cell: ({ getValue }) => {
      const etat = getValue() as string
      return (
        <Badge variant="outline" className={etatColors[etat] || ''}>
          {etat}
        </Badge>
      )
    },
  },
  {
    accessorKey: "_count.recoltes",
    header: "Réc.",
    cell: ({ getValue }) => getValue() || 0,
  },
]

export default function CulturesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<CultureWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const pageSize = 50

  // Charger les données
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/cultures?page=${pageIndex + 1}&pageSize=${pageSize}`
      )
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setPageCount(result.totalPages)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les cultures",
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
    router.push("/cultures/new")
  }

  const handleRowClick = (row: CultureWithRelations) => {
    router.push(`/cultures/${row.id}`)
  }

  const handleDelete = async (row: CultureWithRelations) => {
    if (!confirm(`Supprimer la culture #${row.id} ?`)) return

    try {
      const response = await fetch(`/api/cultures/${row.id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Erreur lors de la suppression")
      toast({
        title: "Culture supprimée",
        description: `La culture #${row.id} a été supprimée`,
      })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer la culture",
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
            <Leaf className="h-6 w-6 text-green-600" />
            <h1 className="text-xl font-bold">Cultures</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
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
          onRowClick={handleRowClick}
          onRowDelete={handleDelete}
          searchPlaceholder="Rechercher une culture..."
          emptyMessage="Aucune culture trouvée. Cliquez sur Ajouter pour créer la première."
        />
      </main>
    </div>
  )
}
