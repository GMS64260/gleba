"use client"

/**
 * Page ITPs - Itinéraires Techniques de Plantes
 * Liste des ITPs avec filtrage par espece
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatSemaine } from "@/lib/assistant-helpers"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Route, Calendar, Ruler } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

// Type pour les ITPs avec relations
interface ITPWithRelations {
  id: string
  especeId: string | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  dureePepiniere: number | null
  dureeCulture: number | null
  nbRangs: number | null
  espacement: number | null
  notes: string | null
  typePlanche: string | null
  modeDemarrage: string | null
  espece: {
    id: string
    couleur: string | null
    famille: { id: string; couleur: string | null } | null
  } | null
  _count: { cultures: number; rotationsDetails: number }
}

// PROMPT 05 — Audit agronomique : ne plus exposer les identifiants techniques
// (ex. "ITP-AIL-01") en liste. On construit un libellé lisible à partir de
// l'espèce, du mode de démarrage et du type de planche. L'identifiant reste
// utilisé en BDD et sert d'ancre d'URL.
function formatItpLabel(itp: ITPWithRelations): string {
  const id = itp.id
  // Heuristique : si l'id est déjà lisible (commence par un nom d'espèce
  // capitalisé), on le garde tel quel.
  if (!/^ITP-/i.test(id)) return id
  const espece = itp.espece?.id ?? itp.especeId ?? 'ITP'
  const mode = itp.modeDemarrage ?? itp.typePlanche ?? 'plein champ'
  return `${espece} — ${mode.toLowerCase()}`
}

// Formatage semaine

// Colonnes du tableau
const columns: ColumnDef<ITPWithRelations>[] = [
  {
    accessorKey: "id",
    header: "ITP",
    cell: ({ row }) => {
      const itp = row.original
      const couleur = itp.espece?.couleur || itp.espece?.famille?.couleur || '#888888'
      // L'identifiant interne reste accessible via `title` (debug, support).
      return (
        <div className="flex items-center gap-2" title={itp.id}>
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: couleur }}
          />
          <span className="font-medium">{formatItpLabel(itp)}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "espece.id",
    header: "Espèce",
    cell: ({ row }) => row.original.espece?.id || "-",
  },
  {
    accessorKey: "semaineSemis",
    header: "Semis",
    cell: ({ getValue }) => (
      <Badge variant="outline" className="text-xs">
        {formatSemaine(getValue() as number | null)}
      </Badge>
    ),
  },
  {
    accessorKey: "semainePlantation",
    header: "Plantation",
    cell: ({ getValue }) => (
      <Badge variant="outline" className="text-xs">
        {formatSemaine(getValue() as number | null)}
      </Badge>
    ),
  },
  {
    accessorKey: "semaineRecolte",
    header: "Récolte",
    cell: ({ getValue }) => (
      <Badge variant="secondary" className="text-xs">
        {formatSemaine(getValue() as number | null)}
      </Badge>
    ),
  },
  {
    accessorKey: "dureePepiniere",
    header: "Pépinière",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? `${val}j` : "-"
    },
  },
  {
    accessorKey: "dureeCulture",
    header: "Culture",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? `${val}j` : "-"
    },
  },
  {
    accessorKey: "nbRangs",
    header: "Rangs",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "espacement",
    header: "Esp. (cm)",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "_count.rotationsDetails",
    header: "Rotations",
    cell: ({ getValue }) => getValue() || 0,
  },
  {
    accessorKey: "_count.cultures",
    header: "Cultures",
    cell: ({ getValue }) => getValue() || 0,
  },
]

export default function ITPsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<ITPWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const pageSize = 50

  // Charger les données
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const url = `/api/itps?page=${pageIndex + 1}&pageSize=${pageSize}`
      const response = await fetch(url)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setPageCount(result.totalPages)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les ITPs",
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
    router.push("/itps/new")
  }

  const handleRowClick = (row: ITPWithRelations) => {
    router.push(`/itps/${encodeURIComponent(row.id)}`)
  }

  const handleEdit = (row: ITPWithRelations) => {
    router.push(`/itps/${encodeURIComponent(row.id)}`)
  }

  const handleDelete = async (row: ITPWithRelations) => {
    if (row._count.cultures > 0 || row._count.rotationsDetails > 0) {
      toast({
        variant: "destructive",
        title: "Impossible de supprimer",
        description: `${row.id} est utilise dans ${row._count.cultures} culture(s) et ${row._count.rotationsDetails} rotation(s)`,
      })
      return
    }

    if (!confirm(`Supprimer l'ITP "${row.id}" ?`)) return

    try {
      const response = await fetch(`/api/itps/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Erreur lors de la suppression")
      toast({
        title: "ITP supprime",
        description: `L'ITP "${row.id}" a ete supprime`,
      })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer l'ITP",
      })
    }
  }

  // Export CSV
  const handleExport = () => {
    const headers = ["ITP", "Espèce", "S.Semis", "S.Plantation", "S.Récolte", "Pépinière (j)", "Culture (j)", "Rangs", "Espacement (cm)"]
    const rows = data.map(i => [
      i.id,
      i.espece?.id || "",
      i.semaineSemis?.toString() || "",
      i.semainePlantation?.toString() || "",
      i.semaineRecolte?.toString() || "",
      i.dureePepiniere?.toString() || "",
      i.dureeCulture?.toString() || "",
      i.nbRangs?.toString() || "",
      i.espacement?.toString() || "",
    ])

    const csv = [headers, ...rows].map(r => r.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "itps.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Accueil
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Route className="h-6 w-6 text-indigo-600" />
              <h1 className="text-xl font-bold">Itinéraires Techniques (ITP)</h1>
            </div>
          </div>
          <Link href="/itps/calendrier">
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Calendrier</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Info */}
        <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div className="text-sm text-indigo-800">
              <p className="font-medium">Qu'est-ce qu'un ITP ?</p>
              <p className="mt-1 text-indigo-700">
                Un Itinéraire Technique de Plante définit le calendrier cultural : semaines de semis, plantation et recolte,
                ainsi que les parametres de culture (nombre de rangs, espacement). Les ITPs sont utilises dans les rotations
                pour planifier automatiquement les cultures.
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
          searchPlaceholder="Rechercher un ITP..."
          emptyMessage="Aucun ITP trouve. Cliquez sur + pour en créer un."
        />
      </main>
    </div>
  )
}
