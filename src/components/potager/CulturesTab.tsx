"use client"

/**
 * Onglet Cultures - Liste des cultures avec actions rapides
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { CloudRain, Droplets, Leaf, ListTodo, Sprout, TreeDeciduous, Apple, CheckCircle } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { useToast } from "@/hooks/use-toast"
import type { PluviometrieBulkItem } from "@/app/api/meteo/pluviometrie-bulk/route"

const CULTURE_ETATS = [
  { value: "all", label: "Toutes", icon: Leaf },
  { value: "Planifiée", label: "Planifiées", icon: ListTodo },
  { value: "Semée", label: "Semées", icon: Sprout },
  { value: "Plantée", label: "Plantées", icon: TreeDeciduous },
  { value: "En récolte", label: "En récolte", icon: Apple },
  { value: "Terminée", label: "Terminées", icon: CheckCircle },
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
    nom: string | null
    famille: { id: string; couleur: string | null } | null
  }
  variete: { id: string; nom: string | null; isPlaceholder?: boolean } | null
  planche: { id: string; nom?: string } | null
  _count: { recoltes: number }
}

const etatColors: Record<string, string> = {
  Planifiée: "bg-blue-100 text-blue-800",
  Semée: "bg-green-100 text-green-800",
  Plantée: "bg-lime-100 text-lime-800",
  "En récolte": "bg-amber-100 text-amber-800",
  Terminée: "bg-slate-100 text-slate-800",
}

// Audit Marc 2026-05-14 — Bug 32 : la colonne "Pluie 7j" affichait la
// même valeur sur les 19 lignes du tableau (toutes les planches d'une
// exploitation partagent le même centroïde météo). C'est du bruit qui
// ne porte aucune info par ligne. On la sort du tableau et on affiche
// l'info une seule fois en bandeau au-dessus.
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
      header: "Espèce",
      cell: ({ row }) => {
        const espece = row.original.espece
        const couleur = espece?.famille?.couleur || "#888888"
        return (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: couleur }} />
            <span className="font-medium">{espece?.nom ?? espece?.id}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "variete.id",
      header: "Variété",
      cell: ({ row }) => {
        const v = row.original.variete
        if (!v || v.isPlaceholder) {
          return (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              À renseigner
            </span>
          )
        }
        return <span>{v.nom ?? v.id}</span>
      },
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
                        : "bg-slate-100 text-slate-400 hover:bg-slate-200"
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
                        : "bg-slate-100 text-slate-400 hover:bg-slate-200"
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
                        : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                    }`}
                  >
                    <Apple className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {culture.recolteFaite ? "Récolte faite" : "Marquer récolte faite"}
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
          <Badge variant="outline" className={etatColors[etat] || ""}>
            {etat}
          </Badge>
        )
      },
    },
    {
      accessorKey: "_count.recoltes",
      header: "Récoltes",
      cell: ({ getValue }) => getValue() || 0,
    },
  ]
}

// QA Camille 2026-05-15 — Bug #2 : le tableau cultures ne se mettait
// pas à jour au changement d'année (le composant n'avait aucune prop
// year et `/api/cultures` n'était pas filtré). On accepte désormais
// `year` et on le pousse en query string vers l'API.
interface CulturesTabProps {
  year?: number
}

export function CulturesTab({ year }: CulturesTabProps = {}) {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<CultureWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [selectedEtat, setSelectedEtat] = React.useState("all")
  const [pluieMap, setPluieMap] = React.useState<Map<string, PluviometrieBulkItem>>(new Map())
  const [cultureToDelete, setCultureToDelete] = React.useState<CultureWithRelations | null>(null)
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

  // Bug 32 — Résumé pluie global (au lieu de la colonne dupliquée 19×).
  // On prend la médiane des planches en plein air (les planches sous abri
  // ne reçoivent pas de pluie directe et sont exclues).
  const pluieResume = React.useMemo(() => {
    const items = Array.from(pluieMap.values()).filter((p) => !p.sousAbri && p.total7j !== null)
    if (items.length === 0) return null
    const total7j = items.reduce((s, i) => s + (i.total7j ?? 0), 0) / items.length
    const joursSansPluie = Math.max(...items.map((i) => i.joursSansPluie ?? 0))
    return { total7j: Math.round(total7j * 10) / 10, joursSansPluie, nbPlanches: items.length }
  }, [pluieMap])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = `/api/cultures?page=${pageIndex + 1}&pageSize=${pageSize}`
      if (year) {
        url += `&annee=${year}`
      }
      if (selectedEtat && selectedEtat !== "all") {
        url += `&etat=${encodeURIComponent(selectedEtat)}`
      }
      const response = await fetch(url)
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      const cultures: CultureWithRelations[] = result.data
      setData(cultures)
      setPageCount(result.totalPages)

      // Fetch pluviométrie pour les planches uniques (en arrière-plan)
      const plancheIds = [...new Set(
        cultures.map(c => c.planche?.id).filter(Boolean) as string[]
      )]
      if (plancheIds.length > 0) {
        fetch(`/api/meteo/pluviometrie-bulk?ids=${plancheIds.join(',')}`)
          .then(r => r.json())
          .then((items: PluviometrieBulkItem[]) => {
            const map = new Map<string, PluviometrieBulkItem>()
            items.forEach(item => map.set(item.plancheId, item))
            setPluieMap(map)
          })
          .catch(() => { /* silencieux */ })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les cultures" })
    } finally {
      setIsLoading(false)
    }
  }, [pageIndex, selectedEtat, year, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleEtatChange = (etat: string) => {
    setSelectedEtat(etat)
    setPageIndex(0)
  }

  return (
    <div className="space-y-4">
      {/* Bug 32 — Bandeau pluie (avant : colonne dupliquée sur chaque
          ligne, info inutile car identique pour toutes les planches). */}
      {pluieResume && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-md border bg-slate-50 text-xs text-slate-600">
          {pluieResume.total7j >= 5 ? (
            <CloudRain className="h-4 w-4 text-blue-600 flex-shrink-0" />
          ) : (
            <Droplets className="h-4 w-4 text-amber-600 flex-shrink-0" />
          )}
          <span>
            <strong>{pluieResume.total7j} mm</strong> de pluie cumulée sur 7 j
            {pluieResume.joursSansPluie > 0 && (
              <> · {pluieResume.joursSansPluie} jour{pluieResume.joursSansPluie > 1 ? "s" : ""} sans pluie</>
            )}
            <span className="text-muted-foreground"> (moyenne {pluieResume.nbPlanches} planches plein air)</span>
          </span>
        </div>
      )}

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
        onRowDelete={(row) => setCultureToDelete(row)}
        searchPlaceholder="Rechercher une culture..."
        emptyMessage="Aucune culture trouvée."
      />

      <DeleteConfirmDialog
        open={cultureToDelete !== null}
        onOpenChange={(open) => !open && setCultureToDelete(null)}
        entityLabel={cultureToDelete ? `la culture #${cultureToDelete.id}` : ""}
        dependencies={
          cultureToDelete
            ? [{ label: "récoltes liées", count: cultureToDelete._count?.recoltes ?? 0 }]
            : []
        }
        onConfirm={async () => {
          if (!cultureToDelete) return
          try {
            const res = await fetch(`/api/cultures/${cultureToDelete.id}`, { method: "DELETE" })
            if (res.ok) {
              toast({ title: "Culture supprimée" })
              fetchData()
            } else {
              const p = await res.json().catch(() => null)
              toast({ variant: "destructive", title: "Erreur", description: p?.error || "Impossible de supprimer la culture" })
            }
          } catch {
            toast({ variant: "destructive", title: "Erreur" })
          }
        }}
      />
    </div>
  )
}
