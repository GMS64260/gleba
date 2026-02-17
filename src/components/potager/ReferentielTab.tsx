"use client"

/**
 * Onglet Référentiel - Base de données des espèces
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { Leaf, Salad, TreeDeciduous, Cherry, Sprout, Flower2 } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

const ESPECE_TYPES = [
  { value: "all", label: "Tous", icon: Leaf },
  { value: "legume", label: "Legumes", icon: Salad },
  { value: "aromatique", label: "Aromatiques", icon: Flower2 },
  { value: "engrais_vert", label: "Engrais verts", icon: Sprout },
  { value: "arbre_fruitier", label: "Arbres fruitiers", icon: TreeDeciduous },
  { value: "petit_fruit", label: "Petits fruits", icon: Cherry },
] as const

const TYPE_LABELS: Record<string, string> = {
  legume: "Legume",
  arbre_fruitier: "Arbre fruitier",
  petit_fruit: "Petit fruit",
  aromatique: "Aromatique",
  engrais_vert: "Engrais vert",
}

interface EspeceWithRelations {
  id: string
  type: string
  familleId: string | null
  nomLatin: string | null
  rendement: number | null
  vivace: boolean
  besoinEau: number | null
  aPlanifier: boolean
  couleur: string | null
  categorie: string | null
  famille: { id: string; couleur: string | null } | null
  _count: { varietes: number; cultures: number }
}

function BesoinsEau({ val }: { val: number | null }) {
  if (!val) return <span className="text-muted-foreground">-</span>
  const bars = Math.min(val, 5)
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 h-4 rounded-sm ${i < bars ? "bg-blue-500" : "bg-gray-200"}`}
        />
      ))}
    </div>
  )
}

const columns: ColumnDef<EspeceWithRelations>[] = [
  {
    accessorKey: "id",
    header: "Espece",
    cell: ({ row }) => {
      const espece = row.original
      const couleur = espece.couleur || espece.famille?.couleur || "#888888"
      return (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: couleur }} />
          <span className="font-medium">{espece.id}</span>
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
        <Badge variant="outline" className="text-xs">
          {TYPE_LABELS[type] || type}
        </Badge>
      )
    },
  },
  {
    accessorKey: "familleId",
    header: "Famille",
    cell: ({ row }) => {
      const famille = row.original.famille
      if (!famille) return "-"
      return (
        <div className="flex items-center gap-1.5">
          {famille.couleur && (
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: famille.couleur }} />
          )}
          <span className="text-sm">{famille.id}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "nomLatin",
    header: "Nom latin",
    cell: ({ getValue }) => {
      const val = getValue() as string | null
      return val ? <span className="italic text-sm text-muted-foreground">{val}</span> : "-"
    },
  },
  {
    accessorKey: "rendement",
    header: "Rendement (kg/m2)",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? val.toFixed(1) : "-"
    },
  },
  {
    accessorKey: "besoinEau",
    header: "Eau",
    cell: ({ getValue }) => <BesoinsEau val={getValue() as number | null} />,
  },
  {
    accessorKey: "_count.varietes",
    header: "Varietes",
    cell: ({ getValue }) => getValue() || 0,
  },
  {
    accessorKey: "_count.cultures",
    header: "Cultures",
    cell: ({ getValue }) => getValue() || 0,
  },
]

export function ReferentielTab() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<EspeceWithRelations[]>([])
  const [filteredData, setFilteredData] = React.useState<EspeceWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedType, setSelectedType] = React.useState("all")

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/especes?pageSize=500")
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      const items = Array.isArray(result) ? result : result.data || []
      setData(items)
      setFilteredData(items)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les especes" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  React.useEffect(() => {
    if (selectedType === "all") {
      setFilteredData(data)
    } else {
      setFilteredData(data.filter((e) => e.type === selectedType))
    }
  }, [selectedType, data])

  return (
    <div className="space-y-4">
      <Tabs value={selectedType} onValueChange={setSelectedType}>
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
        data={filteredData}
        isLoading={isLoading}
        showPagination={true}
        pageSize={50}
        onAdd={() => router.push("/especes/new")}
        onRefresh={fetchData}
        onRowClick={(row) => router.push(`/especes/${encodeURIComponent(row.id)}`)}
        onRowEdit={(row) => router.push(`/especes/${encodeURIComponent(row.id)}`)}
        searchPlaceholder="Rechercher une espece..."
        emptyMessage="Aucune espece trouvee."
      />
    </div>
  )
}
