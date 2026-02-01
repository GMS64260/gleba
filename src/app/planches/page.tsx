"use client"

/**
 * Page Planches - Gestion des parcelles
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, LayoutGrid, Wand2 } from "lucide-react"
import { AssistantDialog, AssistantButton } from "@/components/assistant"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { EditableSelectCell } from "@/components/planches/EditableSelectCell"

// Type pour les planches
interface PlancheWithRelations {
  id: string
  largeur: number | null
  longueur: number | null
  surface: number | null
  ilot: string | null
  rotationId: string | null
  rotation: { id: string } | null
  type: string | null
  irrigation: string | null
  typeSol: string | null
  retentionEau: string | null
  _count: { cultures: number; fertilisations: number }
}

// Options pour les selects
const TYPES_SOL = [
  { value: 'Argileux', label: 'Argileux', icon: '🟤' },
  { value: 'Limoneux', label: 'Limoneux', icon: '🟫' },
  { value: 'Sableux', label: 'Sableux', icon: '🟡' },
  { value: 'Mixte', label: 'Mixte', icon: '🌈' },
]

const RETENTION_EAU = [
  { value: 'Faible', label: 'Faible', icon: '💧' },
  { value: 'Moyenne', label: 'Moyenne', icon: '💦' },
  { value: 'Élevée', label: 'Élevée', icon: '💙' },
]

// Fonction pour créer les colonnes (avec callback)
const createColumns = (onUpdate: () => void): ColumnDef<PlancheWithRelations>[] => [
  {
    accessorKey: "id",
    header: "Planche",
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "ilot",
    header: "Îlot",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "largeur",
    header: "Largeur (m)",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? val.toFixed(2) : "-"
    },
  },
  {
    accessorKey: "longueur",
    header: "Longueur (m)",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? val.toFixed(1) : "-"
    },
  },
  {
    accessorKey: "surface",
    header: "Surface (m²)",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? val.toFixed(1) : "-"
    },
  },
  {
    accessorKey: "rotation.id",
    header: "Rotation",
    cell: ({ row }) => row.original.rotation?.id || "-",
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "typeSol",
    header: "Sol",
    cell: ({ row }) => (
      <EditableSelectCell
        plancheId={row.original.id}
        field="typeSol"
        value={row.original.typeSol}
        options={TYPES_SOL}
        placeholder="Définir"
        onUpdate={onUpdate}
      />
    ),
  },
  {
    accessorKey: "retentionEau",
    header: "Rétention",
    cell: ({ row }) => (
      <EditableSelectCell
        plancheId={row.original.id}
        field="retentionEau"
        value={row.original.retentionEau}
        options={RETENTION_EAU}
        placeholder="Définir"
        onUpdate={onUpdate}
      />
    ),
  },
  {
    accessorKey: "_count.cultures",
    header: "Cultures",
    cell: ({ getValue }) => getValue() || 0,
  },
]

export default function PlanchesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<PlancheWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [showAssistant, setShowAssistant] = React.useState(false)

  // Charger les données
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/planches?pageSize=200")
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les planches",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  // Créer colonnes avec callback
  const columns = React.useMemo(() => createColumns(fetchData), [fetchData])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handlers
  const handleAdd = () => {
    router.push("/planches/new")
  }

  const handleRowClick = (row: PlancheWithRelations) => {
    router.push(`/planches/${encodeURIComponent(row.id)}`)
  }

  const handleEdit = (row: PlancheWithRelations) => {
    router.push(`/planches/${encodeURIComponent(row.id)}`)
  }

  const handleDelete = async (row: PlancheWithRelations) => {
    if (row._count.cultures > 0) {
      toast({
        variant: "destructive",
        title: "Impossible de supprimer",
        description: `${row.id} a ${row._count.cultures} culture(s) associée(s)`,
      })
      return
    }

    if (!confirm(`Supprimer la planche "${row.id}" ?`)) return

    try {
      const response = await fetch(`/api/planches/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Erreur lors de la suppression")
      toast({
        title: "Planche supprimée",
        description: `La planche "${row.id}" a été supprimée`,
      })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer la planche",
      })
    }
  }

  // Calcul des stats
  const totalSurface = data.reduce((sum, p) => sum + (p.surface || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Assistant Maraîcher */}
      <AssistantDialog open={showAssistant} onOpenChange={setShowAssistant} />

      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Accueil
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-6 w-6 text-amber-600" />
              <h1 className="text-xl font-bold">Planches</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AssistantButton onClick={() => setShowAssistant(true)} />
            <div className="text-sm text-muted-foreground">
              {data.length} planches • {totalSurface.toFixed(0)} m² total
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          showPagination={false}
          onAdd={handleAdd}
          onRefresh={fetchData}
          onRowClick={handleRowClick}
          onRowEdit={handleEdit}
          onRowDelete={handleDelete}
          searchPlaceholder="Rechercher une planche..."
          emptyMessage="Aucune planche trouvée. Cliquez sur Ajouter pour créer la première."
        />
      </main>
    </div>
  )
}
