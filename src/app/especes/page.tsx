"use client"

/**
 * Page Espèces - Référentiel des plantes cultivables
 * Filtrable par type : Légumes, Arbres fruitiers, Petits fruits, Aromatiques, Engrais verts
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Leaf, Droplets, TreeDeciduous, Cherry, Salad, Sprout, Flower2 } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

// Types d'espèces
const ESPECE_TYPES = [
  { value: 'all', label: 'Tous', icon: Leaf },
  { value: 'legume', label: 'Légumes', icon: Salad },
  { value: 'arbre_fruitier', label: 'Arbres fruitiers', icon: TreeDeciduous },
  { value: 'petit_fruit', label: 'Petits fruits', icon: Cherry },
  { value: 'aromatique', label: 'Aromatiques', icon: Flower2 },
  { value: 'engrais_vert', label: 'Engrais verts', icon: Sprout },
] as const

// Labels pour l'affichage
const TYPE_LABELS: Record<string, string> = {
  legume: 'Légume',
  arbre_fruitier: 'Arbre fruitier',
  petit_fruit: 'Petit fruit',
  aromatique: 'Aromatique',
  engrais_vert: 'Engrais vert',
}

// Type pour les espèces avec relations
interface EspeceWithRelations {
  id: string
  type: string
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
  _count: { varietes: number; cultures: number; arbres?: number }
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
    accessorKey: "type",
    header: "Type",
    cell: ({ getValue }) => {
      const type = getValue() as string
      return (
        <Badge variant="secondary" className="text-xs">
          {TYPE_LABELS[type] || type}
        </Badge>
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
    header: "Rendement",
    cell: ({ row }) => {
      const val = row.original.rendement
      const type = row.original.type
      if (!val) return "-"
      // Affichage différent selon le type
      if (type === 'arbre_fruitier') {
        return `${val} kg/arbre`
      }
      return `${val} kg/m²`
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
  const [selectedType, setSelectedType] = React.useState('all')
  const pageSize = 50

  // Charger les données
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = `/api/especes?page=${pageIndex + 1}&pageSize=${pageSize}`
      if (selectedType && selectedType !== 'all') {
        url += `&type=${selectedType}`
      }
      const response = await fetch(url)
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
  }, [pageIndex, selectedType, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset page when type changes
  const handleTypeChange = (type: string) => {
    setSelectedType(type)
    setPageIndex(0)
  }

  // Handlers
  const handleAdd = () => {
    const url = selectedType && selectedType !== 'all'
      ? `/especes/new?type=${selectedType}`
      : "/especes/new"
    router.push(url)
  }

  const handleRowClick = (row: EspeceWithRelations) => {
    router.push(`/especes/${encodeURIComponent(row.id)}`)
  }

  const handleEdit = (row: EspeceWithRelations) => {
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
    const headers = ["Espèce", "Type", "Famille", "Nom latin", "Rendement", "Vivace", "Besoin N", "Besoin P", "Besoin K", "Besoin Eau"]
    const rows = data.map(e => [
      e.id,
      TYPE_LABELS[e.type] || e.type,
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
    link.download = `especes${selectedType && selectedType !== 'all' ? `-${selectedType}` : ''}.csv`
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
        {/* Filtres par type */}
        <Tabs value={selectedType} onValueChange={handleTypeChange} className="mb-4">
          <TabsList className="flex-wrap h-auto gap-1">
            {ESPECE_TYPES.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="flex items-center gap-1">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

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
          searchPlaceholder="Rechercher une espèce..."
          emptyMessage="Aucune espèce trouvée. Lancez npm run db:seed pour ajouter les données de base."
        />
      </main>
    </div>
  )
}
