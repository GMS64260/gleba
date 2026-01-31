"use client"

/**
 * Page Associations de plantes (compagnonnage)
 * Liste des associations avec leurs détails
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Heart, Leaf, Users } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

// Type pour les associations avec relations
interface AssociationWithRelations {
  id: string
  nom: string
  description: string | null
  notes: string | null
  details: {
    id: number
    especeId: string | null
    familleId: string | null
    groupe: string | null
    requise: boolean
    espece: { id: string; couleur: string | null } | null
    famille: { id: string; couleur: string | null } | null
  }[]
}

// Colonnes du tableau
const columns: ColumnDef<AssociationWithRelations>[] = [
  {
    accessorKey: "nom",
    header: "Association",
    cell: ({ row }) => {
      const asso = row.original
      return (
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-pink-500" />
          <span className="font-medium">{asso.nom}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "details",
    header: "Especes/Familles",
    cell: ({ row }) => {
      const details = row.original.details
      if (!details || details.length === 0) {
        return <span className="text-muted-foreground">-</span>
      }

      return (
        <div className="flex flex-wrap gap-1">
          {details.slice(0, 5).map((d, i) => {
            const name = d.especeId || d.familleId || d.groupe || "?"
            const color = d.espece?.couleur || d.famille?.couleur || "#888"
            return (
              <Badge
                key={i}
                variant={d.requise ? "default" : "outline"}
                className="text-xs"
                style={{ borderColor: color }}
              >
                {d.requise && "★ "}
                {name}
              </Badge>
            )
          })}
          {details.length > 5 && (
            <Badge variant="secondary" className="text-xs">
              +{details.length - 5}
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ getValue }) => {
      const desc = getValue() as string | null
      if (!desc) return <span className="text-muted-foreground">-</span>
      return (
        <span className="text-sm text-muted-foreground line-clamp-2">
          {desc}
        </span>
      )
    },
  },
  {
    id: "nbRequises",
    header: "Requises",
    cell: ({ row }) => {
      const count = row.original.details.filter((d) => d.requise).length
      return count > 0 ? (
        <Badge variant="default" className="bg-green-600">
          {count}
        </Badge>
      ) : (
        <span className="text-muted-foreground">0</span>
      )
    },
  },
  {
    id: "nbTotal",
    header: "Total",
    cell: ({ row }) => row.original.details.length,
  },
]

export default function AssociationsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<AssociationWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  // Charger les données
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/associations")
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les associations",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handlers
  const handleAdd = () => {
    router.push("/associations/new")
  }

  const handleRowClick = (row: AssociationWithRelations) => {
    router.push(`/associations/${row.id}`)
  }

  const handleEdit = (row: AssociationWithRelations) => {
    router.push(`/associations/${row.id}`)
  }

  const handleDelete = async (row: AssociationWithRelations) => {
    if (!confirm(`Supprimer l'association "${row.nom}" ?`)) return

    try {
      const response = await fetch(`/api/associations/${row.id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Erreur lors de la suppression")
      toast({
        title: "Association supprimee",
        description: `L'association "${row.nom}" a ete supprimee`,
      })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer l'association",
      })
    }
  }

  // Export CSV
  const handleExport = () => {
    const headers = ["Nom", "Description", "Especes", "Familles", "Nb Requises", "Nb Total"]
    const rows = data.map((a) => [
      a.nom,
      a.description || "",
      a.details.filter((d) => d.especeId).map((d) => d.especeId).join(", "),
      a.details.filter((d) => d.familleId).map((d) => d.familleId).join(", "),
      a.details.filter((d) => d.requise).length.toString(),
      a.details.length.toString(),
    ])

    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "associations.csv"
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
            <Heart className="h-6 w-6 text-pink-600" />
            <h1 className="text-xl font-bold">Associations de plantes</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Info */}
        <div className="mb-4 p-4 bg-pink-50 rounded-lg border border-pink-200">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-pink-600 mt-0.5" />
            <div className="text-sm text-pink-800">
              <p className="font-medium">Compagnonnage</p>
              <p className="mt-1 text-pink-700">
                Les associations de plantes (compagnonnage) definissent quelles especes ou familles
                se beneficient mutuellement lorsqu'elles sont cultivees a proximite.
                Une association <strong>requise</strong> (★) indique une dependance forte.
              </p>
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          showPagination={true}
          pageSize={10}
          onAdd={handleAdd}
          onRefresh={fetchData}
          onExport={handleExport}
          onRowClick={handleRowClick}
          onRowEdit={handleEdit}
          onRowDelete={handleDelete}
          searchPlaceholder="Rechercher une association..."
          emptyMessage="Aucune association trouvee. Cliquez sur + pour en creer une."
        />
      </main>
    </div>
  )
}
