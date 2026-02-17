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
import { ArrowLeft, Leaf, ListTodo, Sprout, TreeDeciduous, Apple, CheckCircle, Droplets } from "lucide-react"
import { AssistantDialog, AssistantButton } from "@/components/assistant"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"

// Types d'états pour le filtre
const CULTURE_ETATS = [
  { value: 'all', label: 'Toutes', icon: Leaf },
  { value: 'Planifiée', label: 'Planifiées', icon: ListTodo },
  { value: 'Semée', label: 'Semées', icon: Sprout },
  { value: 'Plantée', label: 'Plantées', icon: TreeDeciduous },
  { value: 'En récolte', label: 'En récolte', icon: Apple },
  { value: 'Terminée', label: 'Terminées', icon: CheckCircle },
] as const

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

// Fonction pour creer les colonnes avec les callbacks
function createColumns(
  onQuickUpdate: (id: number, field: string, value: boolean) => void
): ColumnDef<CultureWithRelations>[] {
  return [
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
      accessorKey: "planche.nom",
      header: "Planche",
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      accessorKey: "annee",
      header: "Année",
    },
    {
      id: "actions_rapides",
      header: "Actions",
      cell: ({ row }) => {
        const culture = row.original
        return (
          <TooltipProvider delayDuration={100}>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {/* Semis */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onQuickUpdate(culture.id, 'semisFait', !culture.semisFait)
                    }}
                    className={`p-1.5 rounded-md transition-colors ${
                      culture.semisFait
                        ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    <Sprout className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {culture.semisFait ? 'Semis fait ✓' : 'Marquer semis fait'}
                </TooltipContent>
              </Tooltip>

              {/* Plantation */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onQuickUpdate(culture.id, 'plantationFaite', !culture.plantationFaite)
                    }}
                    className={`p-1.5 rounded-md transition-colors ${
                      culture.plantationFaite
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    <TreeDeciduous className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {culture.plantationFaite ? 'Plantation faite ✓' : 'Marquer plantation faite'}
                </TooltipContent>
              </Tooltip>

              {/* Récolte */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onQuickUpdate(culture.id, 'recolteFaite', !culture.recolteFaite)
                    }}
                    className={`p-1.5 rounded-md transition-colors ${
                      culture.recolteFaite
                        ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    <Apple className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {culture.recolteFaite ? 'Récolte faite ✓' : 'Marquer récolte faite'}
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        )
      },
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
      header: "Plant.",
      cell: ({ getValue }) => {
        const date = getValue() as string | null
        return date ? format(new Date(date), "dd/MM", { locale: fr }) : "-"
      },
    },
    {
      accessorKey: "dateRecolte",
      header: "Réc.",
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
      header: "Nb",
      cell: ({ getValue }) => getValue() || 0,
    },
  ]
}

export default function CulturesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<CultureWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [selectedEtat, setSelectedEtat] = React.useState('all')
  const [showAssistant, setShowAssistant] = React.useState(false)
  const pageSize = 50

  // Mise a jour rapide d'une culture
  const handleQuickUpdate = React.useCallback(async (id: number, field: string, value: boolean) => {
    try {
      const response = await fetch(`/api/cultures/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!response.ok) throw new Error('Erreur')

      // Mettre a jour localement
      setData(prev => prev.map(c => {
        if (c.id !== id) return c
        const updated = { ...c, [field]: value }
        // Recalculer l'etat
        updated.etat = updated.terminee
          ? 'Terminée'
          : updated.recolteFaite
            ? 'En récolte'
            : updated.plantationFaite
              ? 'Plantée'
              : updated.semisFait
                ? 'Semée'
                : 'Planifiée'
        return updated
      }))

      toast({
        title: value ? 'Fait !' : 'Annule',
        description: `${field.replace(/Fait.*/, '').replace(/Faite.*/, '')} mis a jour`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de mettre a jour',
      })
    }
  }, [toast])

  // Colonnes avec callbacks
  const columns = React.useMemo(
    () => createColumns(handleQuickUpdate),
    [handleQuickUpdate]
  )

  // Charger les données
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = `/api/cultures?page=${pageIndex + 1}&pageSize=${pageSize}`
      if (selectedEtat && selectedEtat !== 'all') {
        url += `&etat=${encodeURIComponent(selectedEtat)}`
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
        description: "Impossible de charger les cultures",
      })
    } finally {
      setIsLoading(false)
    }
  }, [pageIndex, selectedEtat, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset page when etat changes
  const handleEtatChange = (etat: string) => {
    setSelectedEtat(etat)
    setPageIndex(0)
  }

  // Handlers
  const handleAdd = () => {
    router.push("/cultures/new")
  }

  const handleRowClick = (row: CultureWithRelations) => {
    router.push(`/cultures/${row.id}`)
  }

  const handleEdit = (row: CultureWithRelations) => {
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
              <Leaf className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-bold">Cultures</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AssistantButton onClick={() => setShowAssistant(true)} />
            <Link href="/taches">
              <Button variant="outline" size="sm">
                <CheckCircle className="h-4 w-4 mr-2" />
                Taches
              </Button>
            </Link>
            <Link href="/cultures/irriguer">
              <Button variant="outline" size="sm">
                <Droplets className="h-4 w-4 mr-2" />
                Irrigation
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Filtres par état */}
        <Tabs value={selectedEtat} onValueChange={handleEtatChange} className="mb-4">
          <TabsList className="flex-wrap h-auto gap-1">
            {CULTURE_ETATS.map(({ value, label, icon: Icon }) => (
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
          onRowClick={handleRowClick}
          onRowEdit={handleEdit}
          onRowDelete={handleDelete}
          searchPlaceholder="Rechercher une culture..."
          emptyMessage="Aucune culture trouvée. Cliquez sur Ajouter pour créer la première."
        />
      </main>
    </div>
  )
}
