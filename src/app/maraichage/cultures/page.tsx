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
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { AppHeader, PageToolbar } from "@/components/shell/AppHeader"

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
    nom: string | null
    famille: { id: string; couleur: string | null } | null
  }
  variete: { id: string; nom: string | null; isPlaceholder?: boolean } | null
  planche: { id: string } | null
  quantite: number | null
  _count: { recoltes: number }
}

// Couleurs des états
const etatColors: Record<string, string> = {
  'Planifiée': 'bg-blue-100 text-blue-800',
  'Semée': 'bg-green-100 text-green-800',
  'Plantée': 'bg-lime-100 text-lime-800',
  'En récolte': 'bg-amber-100 text-amber-800',
  'Terminée': 'bg-slate-100 text-slate-800',
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
            <span className="font-medium">{espece?.nom ?? espece?.id}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "variete.id",
      header: "Variété",
      // Quand la variété n'est pas renseignée, l'API assigne un placeholder
      // nommé « <Espèce> — Non spécifiée » → redondant avec la colonne
      // Espèce. On n'affiche alors qu'un tiret.
      cell: ({ row }) => {
        const v = row.original.variete
        if (!v || v.isPlaceholder) return "—"
        return v.nom ?? v.id
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
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
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
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
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
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
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
      accessorKey: "quantite",
      header: "Plants",
      cell: ({ getValue }) => {
        // BUG-11 : la liste affiche la valeur stored (synchro avec le
        // formulaire, qui met null désormais si inputs incomplets). « — »
        // signale explicitement « calcul impossible » plutôt que faux zéro.
        const v = getValue() as number | null
        return v != null ? v.toLocaleString() : "—"
      },
    },
    {
      accessorKey: "_count.recoltes",
      header: "Récoltes",
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

  // Audit Marc 2026-05-14 — Bug 08 : un clic accidentel sur l'icône Sprout
  // changeait l'état de la culture sans confirmation. On confirme désormais
  // chaque changement (libellé contextualisé selon le sens : marquer/annuler).
  const FIELD_LABELS: Record<string, string> = {
    semisFait: 'le semis',
    plantationFaite: 'la plantation',
    recolteFaite: 'la récolte',
  }

  // Confirmation in-app (remplace window.confirm() invisible des agents
  // de test — feedback testeur 2026-05-26 : « alerte de semence à la
  // validation » non perçue). On stocke l'action en attente puis on
  // l'exécute à la confirmation via <ConfirmDialog>.
  const [pendingUpdate, setPendingUpdate] = React.useState<{
    id: number; field: string; value: boolean; message: string
  } | null>(null)

  const handleQuickUpdate = React.useCallback((id: number, field: string, value: boolean) => {
    const action = value ? 'Marquer' : 'Annuler'
    const sujet = FIELD_LABELS[field] ?? field
    setPendingUpdate({ id, field, value, message: `${action} ${sujet} de la culture #${id} ?` })
  }, [])

  const executeQuickUpdate = React.useCallback(async (id: number, field: string, value: boolean) => {
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
    if (!(await confirmDialog(`Supprimer la culture #${row.id} ?`))) return

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
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Assistant Maraîcher */}
      <AssistantDialog open={showAssistant} onOpenChange={setShowAssistant} />

      {/* Header */}
      <AppHeader current="maraichage" />
      <PageToolbar>
        <div className="flex items-center gap-4">
          <Link href="/">
            {/* Bug #6 — cohérence couleur : page Maraîchage (verte), donc
                bouton Accueil en vert maraîchage (et non orange/élevage). */}
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Accueil
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-green-600" />
            <h1 className="text-xl font-bold">Cultures</h1>
          </div>
        </div>
        {/* Responsive 360px — 3 boutons d'action ne tiennent pas sur une ligne */}
        <div className="flex items-center gap-2 flex-wrap">
          <AssistantButton onClick={() => setShowAssistant(true)} />
          <Link href="/taches">
            <Button variant="outline" size="sm">
              <CheckCircle className="h-4 w-4 mr-2" />
              Taches
            </Button>
          </Link>
          <Link href="/maraichage/cultures/irriguer">
            <Button variant="outline" size="sm">
              <Droplets className="h-4 w-4 mr-2" />
              Irrigation
            </Button>
          </Link>
        </div>
      </PageToolbar>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Bug #30 — Légende repliable des icônes Actions du tableau. */}
        <details className="mb-3 text-xs bg-slate-50 border rounded-md px-3 py-1.5">
          <summary className="cursor-pointer text-slate-700 select-none">
            Actions rapides — légende des icônes
          </summary>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-slate-600">
            <span><Sprout className="inline h-3 w-3 mr-1 text-orange-500" />Semis fait</span>
            <span><TreeDeciduous className="inline h-3 w-3 mr-1 text-green-600" />Plantation faite</span>
            <span><Apple className="inline h-3 w-3 mr-1 text-amber-600" />Récolte faite</span>
          </div>
        </details>

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

      {/* Confirmation in-app du changement d'état (semis/plantation/récolte). */}
      <ConfirmDialog
        open={pendingUpdate !== null}
        onOpenChange={(o) => !o && setPendingUpdate(null)}
        title="Confirmer le changement"
        description={pendingUpdate?.message ?? ""}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        onConfirm={async () => {
          if (pendingUpdate) {
            await executeQuickUpdate(pendingUpdate.id, pendingUpdate.field, pendingUpdate.value)
          }
          setPendingUpdate(null)
        }}
      />
    </div>
  )
}
