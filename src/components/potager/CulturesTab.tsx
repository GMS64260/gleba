"use client"

/**
 * Onglet Cultures - Liste des cultures avec actions rapides
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Leaf, ListTodo, Sprout, TreeDeciduous, Apple, CheckCircle } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"

const CULTURE_ETATS = [
  { value: "all", label: "Toutes", icon: Leaf },
  { value: "Planifiée", label: "Planifiees", icon: ListTodo },
  { value: "Semée", label: "Semees", icon: Sprout },
  { value: "Plantée", label: "Plantees", icon: TreeDeciduous },
  { value: "En récolte", label: "En recolte", icon: Apple },
  { value: "Terminée", label: "Terminees", icon: CheckCircle },
] as const

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

const etatColors: Record<string, string> = {
  Planifiée: "bg-blue-100 text-blue-800",
  Semée: "bg-green-100 text-green-800",
  Plantée: "bg-lime-100 text-lime-800",
  "En récolte": "bg-amber-100 text-amber-800",
  Terminée: "bg-gray-100 text-gray-800",
}

function createColumns(
  onQuickUpdate: (id: number, field: string, value: boolean) => void
): ColumnDef<CultureWithRelations>[] {
  return [
    {
      accessorKey: "id",
      header: "#",
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-muted-foreground">{getValue() as number}</span>
      ),
    },
    {
      accessorKey: "espece.id",
      header: "Espece",
      cell: ({ row }) => {
        const espece = row.original.espece
        const couleur = espece?.famille?.couleur || "#888888"
        return (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: couleur }} />
            <span className="font-medium">{espece?.id}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "variete.id",
      header: "Variete",
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      accessorKey: "planche.nom",
      header: "Planche",
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      accessorKey: "annee",
      header: "Annee",
    },
    {
      id: "actions_rapides",
      header: "Actions",
      cell: ({ row }) => {
        const culture = row.original
        return (
          <TooltipProvider delayDuration={100}>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onQuickUpdate(culture.id, "semisFait", !culture.semisFait)
                    }}
                    className={`p-1.5 rounded-md transition-colors ${
                      culture.semisFait
                        ? "bg-orange-100 text-orange-600 hover:bg-orange-200"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    <Sprout className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {culture.semisFait ? "Semis fait" : "Marquer semis fait"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onQuickUpdate(culture.id, "plantationFaite", !culture.plantationFaite)
                    }}
                    className={`p-1.5 rounded-md transition-colors ${
                      culture.plantationFaite
                        ? "bg-green-100 text-green-600 hover:bg-green-200"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    <TreeDeciduous className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {culture.plantationFaite ? "Plantation faite" : "Marquer plantation faite"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onQuickUpdate(culture.id, "recolteFaite", !culture.recolteFaite)
                    }}
                    className={`p-1.5 rounded-md transition-colors ${
                      culture.recolteFaite
                        ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    <Apple className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {culture.recolteFaite ? "Recolte faite" : "Marquer recolte faite"}
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
      header: "Rec.",
      cell: ({ getValue }) => {
        const date = getValue() as string | null
        return date ? format(new Date(date), "dd/MM", { locale: fr }) : "-"
      },
    },
    {
      accessorKey: "etat",
      header: "Etat",
      cell: ({ getValue }) => {
        const etat = getValue() as string
        return (
          <Badge variant="outline" className={etatColors[etat] || ""}>
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

export function CulturesTab() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<CultureWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [selectedEtat, setSelectedEtat] = React.useState("all")
  const pageSize = 50

  const handleQuickUpdate = React.useCallback(
    async (id: number, field: string, value: boolean) => {
      try {
        const response = await fetch(`/api/cultures/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        })
        if (!response.ok) throw new Error("Erreur")
        setData((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c
            const updated = { ...c, [field]: value }
            updated.etat = updated.terminee
              ? "Terminée"
              : updated.recolteFaite
                ? "En récolte"
                : updated.plantationFaite
                  ? "Plantée"
                  : updated.semisFait
                    ? "Semée"
                    : "Planifiée"
            return updated
          })
        )
        toast({ title: value ? "Fait !" : "Annule" })
      } catch {
        toast({ variant: "destructive", title: "Erreur" })
      }
    },
    [toast]
  )

  const columns = React.useMemo(() => createColumns(handleQuickUpdate), [handleQuickUpdate])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = `/api/cultures?page=${pageIndex + 1}&pageSize=${pageSize}`
      if (selectedEtat && selectedEtat !== "all") {
        url += `&etat=${encodeURIComponent(selectedEtat)}`
      }
      const response = await fetch(url)
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      setData(result.data)
      setPageCount(result.totalPages)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les cultures" })
    } finally {
      setIsLoading(false)
    }
  }, [pageIndex, selectedEtat, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleEtatChange = (etat: string) => {
    setSelectedEtat(etat)
    setPageIndex(0)
  }

  return (
    <div className="space-y-4">
      {/* Filtres par état */}
      <Tabs value={selectedEtat} onValueChange={handleEtatChange}>
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
        onAdd={() => router.push("/cultures/new")}
        onRefresh={fetchData}
        onRowClick={(row) => router.push(`/cultures/${row.id}`)}
        onRowEdit={(row) => router.push(`/cultures/${row.id}`)}
        onRowDelete={async (row) => {
          if (!confirm(`Supprimer la culture #${row.id} ?`)) return
          try {
            await fetch(`/api/cultures/${row.id}`, { method: "DELETE" })
            toast({ title: "Culture supprimee" })
            fetchData()
          } catch {
            toast({ variant: "destructive", title: "Erreur" })
          }
        }}
        searchPlaceholder="Rechercher une culture..."
        emptyMessage="Aucune culture trouvee."
      />
    </div>
  )
}
