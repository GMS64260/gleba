"use client"

/**
 * Page Espèces - Référentiel des plantes cultivables
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Leaf, Droplets } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

// Type pour les espèces avec relations
interface EspeceWithRelations {
  id: string
  familleId: string | null
  nomLatin: string | null
  rendement: number | null
  vivace: boolean
  besoinN: number | null
  besoinP: number | null
  besoinK: number | null
  besoinEau: number | null
  aPlanifier: boolean
  couleur: string | null
  description: string | null
  famille: { id: string; couleur: string | null } | null
  _count: { varietes: number; cultures: number }
}

// Composant pour afficher les besoins NPK
function BesoinsNPK({ n, p, k }: { n: number | null; p: number | null; k: number | null }) {
  const getColor = (val: number | null) => {
    if (!val) return 'bg-gray-200'
    if (val <= 2) return 'bg-green-400'
    if (val <= 3) return 'bg-yellow-400'
    return 'bg-red-400'
  }

  return (
    <div className="flex gap-0.5">
      <div className={`w-4 h-4 rounded text-[10px] flex items-center justify-center text-white ${getColor(n)}`}>
        N
      </div>
      <div className={`w-4 h-4 rounded text-[10px] flex items-center justify-center text-white ${getColor(p)}`}>
        P
      </div>
      <div className={`w-4 h-4 rounded text-[10px] flex items-center justify-center text-white ${getColor(k)}`}>
        K
      </div>
    </div>
  )
}

// Colonnes du tableau
const columns: ColumnDef<EspeceWithRelations>[] = [
  {
    accessorKey: "id",
    header: "Espèce",
    cell: ({ row }) => {
      const espece = row.original
      const couleur = espece.couleur || espece.famille?.couleur || '#888888'
      return (
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: couleur }}
          />
          <span className="font-medium">{espece.id}</span>
          {espece.vivace && (
            <Badge variant="outline" className="text-xs">Vivace</Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "famille.id",
    header: "Famille",
    cell: ({ row }) => row.original.famille?.id || "-",
  },
  {
    accessorKey: "nomLatin",
    header: "Nom latin",
    cell: ({ getValue }) => (
      <span className="italic text-muted-foreground">
        {(getValue() as string) || "-"}
      </span>
    ),
  },
  {
    accessorKey: "rendement",
    header: "Rdt (kg/m²)",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? val.toFixed(1) : "-"
    },
  },
  {
    id: "besoins",
    header: "Besoins NPK",
    cell: ({ row }) => (
      <BesoinsNPK
        n={row.original.besoinN}
        p={row.original.besoinP}
        k={row.original.besoinK}
      />
    ),
  },
  {
    accessorKey: "besoinEau",
    header: "Eau",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      if (!val) return "-"
      return (
        <div className="flex items-center gap-1">
          {Array.from({ length: val }).map((_, i) => (
            <Droplets key={i} className="w-3 h-3 text-blue-500" />
          ))}
        </div>
      )
    },
  },
  {
    accessorKey: "_count.varietes",
    header: "Var.",
    cell: ({ getValue }) => getValue() || 0,
  },
  {
    accessorKey: "_count.cultures",
    header: "Cult.",
    cell: ({ getValue }) => getValue() || 0,
  },
  {
    accessorKey: "aPlanifier",
    header: "Planif.",
    cell: ({ getValue }) => (
      getValue() ? "✓" : "-"
    ),
  },
]

export default function EspecesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<EspeceWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const pageSize = 50

  // Charger les données
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/especes?page=${pageIndex + 1}&pageSize=${pageSize}`
      )
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setPageCount(result.totalPages)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les espèces",
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
    router.push("/especes/new")
  }

  const handleRowClick = (row: EspeceWithRelations) => {
    router.push(`/especes/${encodeURIComponent(row.id)}`)
  }

  const handleDelete = async (row: EspeceWithRelations) => {
    if (row._count.cultures > 0) {
      toast({
        variant: "destructive",
        title: "Impossible de supprimer",
        description: `${row.id} a ${row._count.cultures} culture(s) associée(s)`,
      })
      return
    }

    if (!confirm(`Supprimer l'espèce "${row.id}" ?`)) return

    try {
      const response = await fetch(`/api/especes/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Erreur lors de la suppression")
      toast({
        title: "Espèce supprimée",
        description: `L'espèce "${row.id}" a été supprimée`,
      })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer l'espèce",
      })
    }
  }

  // Export CSV
  const handleExport = () => {
    const headers = ["Espèce", "Famille", "Nom latin", "Rendement", "Vivace", "Besoin N", "Besoin P", "Besoin K", "Besoin Eau"]
    const rows = data.map(e => [
      e.id,
      e.famille?.id || "",
      e.nomLatin || "",
      e.rendement?.toString() || "",
      e.vivace ? "Oui" : "Non",
      e.besoinN?.toString() || "",
      e.besoinP?.toString() || "",
      e.besoinK?.toString() || "",
      e.besoinEau?.toString() || "",
    ])

    const csv = [headers, ...rows].map(r => r.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "especes.csv"
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
            <Leaf className="h-6 w-6 text-emerald-600" />
            <h1 className="text-xl font-bold">Espèces</h1>
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
          onExport={handleExport}
          onRowClick={handleRowClick}
          onRowDelete={handleDelete}
          searchPlaceholder="Rechercher une espèce..."
          emptyMessage="Aucune espèce trouvée. Lancez npm run db:seed pour ajouter les données de base."
        />
      </main>
    </div>
  )
}
